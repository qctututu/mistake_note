"""
题目修改引擎 - 将原题做适当变形

核心策略：
  1. 数字替换：将题目/答案中的数字做小幅偏移
  2. 变量替换：修改变量名（x→a, y→b）
  3. 表述替换：同义结构替换
  4. 条件变换：增加/减少条件

注：这是基于规则的轻量实现。更高级的变形可对接 LLM。
"""
import re
import random

random.seed()


# ─── 数字替换 ─────────────────────────────────────────

def _replace_numbers(text: str, shift_range: tuple = (-3, 3)) -> str:
    """将 text 中的所有整数做小幅偏移"""

    def _shift(m):
        val = int(m.group())
        # 留几位随机种子保证同一题变形一致
        shift = random.randint(shift_range[0], shift_range[1])
        new_val = max(1, val + shift)  # 不低于 1
        return str(new_val)

    return re.sub(r'\b\d+\b', _shift, text)


# ─── 变量替换 ─────────────────────────────────────────

_VARIABLE_MAP = {
    'x': ['x', 'a', 'm', 't', 'p'],
    'y': ['y', 'b', 'n', 'q'],
    'z': ['z', 'c', 'k'],
    'a': ['a', 'x', 'm', 'u'],
    'b': ['b', 'y', 'n', 'v'],
    'c': ['c', 'z', 'p', 'w'],
    'm': ['m', 'x', 'a', 'k'],
    'n': ['n', 'y', 'b', 't'],
    'p': ['p', 'z', 'c', 'q'],
    'k': ['k', 'm', 't', 'p'],
    't': ['t', 'x', 'm', 'k'],
}

# 题目中常见的数学模式正则
_MATH_VAR_RE = re.compile(r'\b([a-zA-Z])\b(?!\s*\()')


def _replace_variables(text: str) -> str:
    """替换单字母变量"""

    def _replace(m):
        var = m.group(1)
        if var in _VARIABLE_MAP:
            choices = _VARIABLE_MAP[var]
            return random.choice(choices)
        return var

    return _MATH_VAR_RE.sub(_replace, text)


# ─── 表述替换 ─────────────────────────────────────────

_PHRASE_MAP = [
    (r'求\s*', '计算'),
    (r'计算\s*', '求'),
    (r'解方程\s*', '求解方程'),
    (r'求解方程\s*', '解方程'),
    (r'化简化简\s*',  '化简'),  # 避免重复
    (r'证明\s*', '求证'),
    (r'求证\s*', '证明'),
    (r'指出\s*', '写出'),
    (r'写出\s*', '指出'),
    (r'求值\s*', '计算'),
    (r'判断\s*', '判定'),
    (r'判定\s*', '判断'),
    (r'下列\s*', '以下'),
    (r'以下\s*', '下列'),
    (r'正确\s*的\s*是', '正确的选项是'),
    (r'不正确\s*的\s*是', '错误的选项是'),
    (r'错误\s*的\s*是', '不正确的选项是'),
    (r'原因\s*是', '理由是'),
    (r'理由是\s*', '原因是'),
    (r'结果是\s*', '答案为'),
    (r'答案为\s*', '结果是'),
    (r'等于\s*', '等于'),
    (r'解集\s*为', '解是'),
]


def _replace_phrases(text: str) -> str:
    """同义表述替换"""
    result = text
    for pattern, replacement in _PHRASE_MAP:
        if random.random() < 0.4:  # 40% 概率替换
            result = re.sub(pattern, replacement, result)
    return result


# ─── 三角函数 / 常用值变形 ──────────────────────────

_ANGLE_MAP = {
    '30°': ['30°', '45°', '60°'],
    '45°': ['45°', '30°', '60°'],
    '60°': ['60°', '45°', '30°'],
    '90°': ['90°'],
    '180°': ['180°'],
    '360°': ['360°'],
    'π/6': ['π/6', 'π/4', 'π/3'],
    'π/4': ['π/4', 'π/3', 'π/6'],
    'π/3': ['π/3', 'π/6', 'π/4'],
    'π/2': ['π/2'],
    'π': ['π'],
}


def _replace_angles(text: str) -> str:
    """变形常见角度值"""

    def _replace(m):
        val = m.group(0)
        if val in _ANGLE_MAP:
            return random.choice(_ANGLE_MAP[val])
        return val

    # 匹配角度表达式
    pattern = r'\b(30°|45°|60°|90°|180°|360°|π/6|π/4|π/3|π/2|π)\b'
    return re.sub(pattern, _replace, text)


# ─── 主入口 ──────────────────────────────────────────

def modify_question(question: dict) -> dict:
    """
    对题目进行变形，返回修改后的副本

    参数:
      question - 原始题目字典（content, correct_answer, ...）

    返回:
      变形后的题目的字典，包含：
        - modified_content
        - modified_correct_answer
        - hint（变形提示，让学生知道从原题变来的）
    """
    random.seed(str(question.get('id', 0)) + datetime.now().strftime('%Y%m%d'))

    content = question.get('content', '')
    answer = question.get('correct_answer', '')

    # 按一定比例组合多种变形策略
    strategies = []

    # 50% 概率做数字替换
    if random.random() < 0.5 and re.search(r'\d+', content):
        strategies.append(_replace_numbers)

    # 40% 概率做变量替换
    if random.random() < 0.4:
        strategies.append(_replace_variables)

    # 70% 概率做角度替换（如果有角度）
    if random.random() < 0.7 and re.search(r'[°π]', content):
        strategies.append(_replace_angles)

    # 40% 概率做同义替换
    if random.random() < 0.4:
        strategies.append(_replace_phrases)

    # 至少应用一种变形
    if not strategies:
        strategies = [_replace_numbers]

    # 依次应用
    modified_content = content
    modified_answer = answer
    for s in strategies:
        modified_content = s(modified_content)
        modified_answer = s(modified_answer)

    return {
        'original_id': question.get('id'),
        'subject': question.get('subject_name', ''),
        'knowledge_points': question.get('knowledge_points', ''),
        'modified_content': modified_content,
        'modified_correct_answer': modified_answer,
        'hint': f'【变形题】基于原题变形，请先理解原题再做此题',
        'strategies_used': [s.__name__ for s in strategies],
    }


def batch_modify(questions: list, count: int = 5) -> list:
    """从题目列表中随机选取 count 道并变形"""
    selected = random.sample(questions, min(count, len(questions)))
    return [modify_question(q) for q in selected]


from datetime import datetime
