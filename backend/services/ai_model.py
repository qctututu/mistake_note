"""
AI 模型客户端 - 支持 OpenAI / DeepSeek / 自定义兼容接口
"""
import json
import os
from openai import OpenAI

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'data', 'ai_config.json')

# ─── 模型配置管理 ──────────────────────────────────────

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_config(config):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    # 合并保存，不要覆盖已有字段
    existing = load_config()
    existing.update(config)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)


def clear_config():
    if os.path.exists(CONFIG_PATH):
        os.remove(CONFIG_PATH)


_DEFAULT_BASE_URLS = {
    'openai': 'https://api.openai.com',
    'deepseek': 'https://api.deepseek.com',
}


def get_client():
    """获取 OpenAI 兼容客户端（根据 model_type 自动切换默认地址）"""
    config = load_config()
    api_key = config.get('api_key', '')
    model_type = config.get('model_type', 'openai')
    base_url = config.get('base_url', '')

    if not base_url:
        base_url = _DEFAULT_BASE_URLS.get(model_type, '')

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url.rstrip('/') + '/v1')
    return OpenAI(api_key=api_key)


# ─── 连接测试 ──────────────────────────────────────────

def test_connection():
    """测试模型连接是否可用"""
    config = load_config()
    api_key = config.get('api_key', '')
    if not api_key:
        return False, "API Key 未设置"

    try:
        client = get_client()
        model = config.get('model_name', 'gpt-3.5-turbo')
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "回复「ok」两个字"}],
            max_tokens=10,
            temperature=0,
        )
        reply = resp.choices[0].message.content if resp.choices else ''
        return True, f"连接成功！模型回复: {reply[:50]}"
    except Exception as e:
        return False, f"连接失败: {str(e)}"


# ─── AI 生成 ───────────────────────────────────────────

def ai_chat(messages, model=None, temperature=0.7, max_tokens=1024):
    """通用 AI 对话"""
    config = load_config()
    client = get_client()
    model = model or config.get('model_name', 'gpt-3.5-turbo')

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content if resp.choices else ''


def _build_field_with_images(text, field_images, label):
    """构建包含图片信息的字段描述"""
    parts = []
    if text and text.strip():
        parts.append(text.strip())
    if field_images:
        for url in field_images:
            parts.append(f'[图片: {url}]')
    if not parts:
        parts.append(f'(该字段内容在图片中)')
    return label + '\n' + '\n'.join(parts)


def generate_similar_question(original_question, correct_answer, wrong_answer, analysis,
                              knowledge_points='', subject='', kb_context='',
                              images=None):
    """
    用 AI 生成一道相似变形题

    参数:
      original_question - 原题
      correct_answer    - 正确答案
      wrong_answer      - 错误答案
      analysis          - 错因分析
      knowledge_points  - 知识点标签
      subject           - 科目
      kb_context        - 知识库检索到的相关上下文
      images            - 图片URL映射 dict，如 {"content":["url1"], "correct_answer":[], "wrong_answer":[]}

    返回:
      {question, answer, hint}
    """
    # 解析 images 参数
    img_map = {}
    if isinstance(images, str):
        try:
            img_map = json.loads(images)
        except (json.JSONDecodeError, TypeError):
            img_map = {}
    elif isinstance(images, dict):
        img_map = images

    system_prompt = """你是一位资深的高中教师，擅长出题和变题。
你的任务是根据一道错题，创作一道「相似但不同」的练习题。

要求：
1. 保持相同的知识点和难度级别
2. 修改数字、条件、问法，但核心考点不变
3. 如果是选择题，可以更改选项顺序，正确选项不一定要和原来相同
4. 题目要有区分度，能检验学生是否真正理解
5. !!! 如果题目或答案中出现了 [图片: http://...] 格式的标记，这说明题目内容在图片中，你需要根据图片 URL 推测题目类型和考点（如果 AI 不支持看图，则根据知识点和上下文尽力生成合理的变形题）
6. 返回 JSON 格式，不要多余文字"""

    user_prompt = f"""请根据以下错题，生成一道变形题：

科目：{subject or '未知'}
知识点：{knowledge_points or '未知'}

{_build_field_with_images(original_question, img_map.get('content', []), '=== 原题 ===')}

{_build_field_with_images(correct_answer, img_map.get('correct_answer', []), '=== 正确答案 ===')}

{_build_field_with_images(wrong_answer, img_map.get('wrong_answer', []), '=== 学生错误答案 ===')}

=== 错因分析 ===
{analysis or '无'}
"""

    if kb_context:
        user_prompt += f"""

=== 参考资料（知识库中与本题相关的上下文）===
{kb_context[:2000]}
"""

    user_prompt += """

请严格按照以下 JSON 格式回复（不要额外文字）：
{
  "question": "变形后的题目内容",
  "answer": "正确答案",
  "hint": "解题思路提示",
  "changed_aspects": "说明做了哪些改动，比如：数字替换、条件变化、问法改变等"
}"""

    try:
        result = ai_chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], temperature=0.8, max_tokens=2048)

        # 解析 JSON
        import re
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {
                'question': data.get('question', ''),
                'answer': data.get('answer', ''),
                'hint': data.get('hint', ''),
                'changed_aspects': data.get('changed_aspects', ''),
            }
        else:
            # fallback: 把全部输出当题目
            return {
                'question': result[:500],
                'answer': '见解析',
                'hint': 'AI 生成的解析',
                'changed_aspects': 'AI 自动生成',
            }
    except Exception as e:
        return {
            'question': f'AI 生成失败: {str(e)}',
            'answer': '',
            'hint': '请检查模型配置或稍后重试',
            'changed_aspects': '',
            'error': str(e),
        }


def grade_practice_answer(original_question, original_answer, modified_content, modified_correct_answer,
                           user_answer, user_answer_images=None, images=None):
    """
    用 AI 批改变形题的用户答案

    返回: { is_correct: bool, feedback: str }
    """
    # 解析原题图片
    img_map = {}
    if isinstance(images, str):
        try: img_map = json.loads(images)
        except: img_map = {}
    elif isinstance(images, dict):
        img_map = images

    system_prompt = """你是一位严谨的学科教师，负责批改学生的变形题答案。
你需要根据以下信息判断学生的答案是否基本正确：
- 原题内容与答案
- 变形后的题目内容与预期答案
- 学生的作答（可能包含图片 URL，图片无法直接查看，请根据文字描述判断）

原则：
1. 核心思路正确即判对，不必每个字都一致
2. 如果有图片，图片 URL 意味着学生可能手写了答案，按文本内容评判
3. 如果学生答案不完整但有正确方向，可以判对并给出提示
4. 如果学生答案关键步骤有误，判错并指出错误

用中文回复，严格按 JSON 格式：
{"is_correct": true/false, "feedback": "评价文字"}"""

    images_info = ''
    if user_answer_images:
        images_info = '\n学生上传了图片答案（URLs: ' + ', '.join(user_answer_images) + '）'

    user_prompt = f"""【原题】
{_build_field_with_images(original_question, img_map.get('content', []), '')}

【原题答案】
{_build_field_with_images(original_answer, img_map.get('correct_answer', []), '')}

【变形题】
{modified_content}

【变形题预期答案】
{modified_correct_answer}

【学生答案】
{user_answer or '（未填写文字答案）'}{images_info}

请判断学生答案是否正确："""

    try:
        result = ai_chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], temperature=0.3, max_tokens=1024)

        import re
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {
                'is_correct': bool(data.get('is_correct', False)),
                'feedback': data.get('feedback', ''),
            }
        return {'is_correct': False, 'feedback': 'AI 无法解析批改结果，请重试'}
    except Exception as e:
        return {'is_correct': False, 'feedback': f'批改失败: {str(e)}'}


def generate_problem_analysis(original_question, original_answer, modified_content, modified_correct_answer,
                               user_answer, is_correct, user_answer_images=None, images=None):
    """
    用 AI 生成变形题的详细解析

    返回: { analysis: str }
    """
    # 解析原题图片
    img_map = {}
    if isinstance(images, str):
        try: img_map = json.loads(images)
        except: img_map = {}
    elif isinstance(images, dict):
        img_map = images

    system_prompt = """你是一位经验丰富的学科教师，擅长用通俗易懂的方式讲解题目。
请根据以下信息生成一份详细的解析：
- 原题与答案
- 变形后的题目与答案
- 学生的作答
- 批改结果（正确/错误）

解析应包括：
1. 变形题的解题思路和关键步骤
2. 与原题的对比，说明变形点
3. 如果学生答错了，指出错误并给出正确解法
4. 相关的易错点提醒

用中文回复，尽量详细清晰。"""

    images_info = ''
    if user_answer_images:
        images_info = '\n学生上传了图片答案（URLs: ' + ', '.join(user_answer_images) + '）'

    user_prompt = f"""【原题】
{_build_field_with_images(original_question, img_map.get('content', []), '')}

【原题答案】
{_build_field_with_images(original_answer, img_map.get('correct_answer', []), '')}

【变形题】
{modified_content}

【变形题答案】
{modified_correct_answer}

【学生答案】
{user_answer or '（未填写文字答案）'}{images_info}

【批改结果】
{'正确' if is_correct else '错误'}

请生成详细的题目解析："""

    try:
        result = ai_chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], temperature=0.5, max_tokens=2048)
        return {'analysis': result}
    except Exception as e:
        return {'analysis': f'生成解析失败: {str(e)}'}
