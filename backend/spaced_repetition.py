"""
SM-2 遗忘曲线算法

复习间隔计算：
  - 每次复习根据质量打分（0-5），更新 ease_factor 和间隔
  - 质量映射：wrong→0, partial→3, correct→5
"""
from datetime import datetime, timedelta
import math


def quality_from_result(result: str) -> int:
    """将复习结果转为 SM-2 质量分"""
    return {'wrong': 0, 'partial': 3, 'correct': 5}.get(result, 0)


def calculate_next_review(q, result: str):
    """
    根据本次复习结果，计算下次复习时间

    参数：
      q           - 题目字典（含 ease_factor, review_interval, review_count）
      result      - 'correct' / 'wrong' / 'partial'

    返回：
      (next_review_at_iso, new_interval_days, new_ease_factor, review_count)
    """
    quality = quality_from_result(result)
    ef = q.get('ease_factor', 2.5)
    interval = q.get('review_interval', 0)
    count = q.get('review_count', 0)

    # ── 更新易度因子 ──
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ef < 1.3:
        ef = 1.3

    # ── 根据质量决定间隔 ──
    if quality < 3:  # 错或部分错 → 重置
        interval = 0
        count = 0
    else:
        count += 1
        if count == 1:
            interval = 1      # 第 1 天
        elif count == 2:
            interval = 6      # 第 6 天
        else:
            interval = round(interval * ef)  # 等比增长

    # ── 计算下次复习日期 ──
    now = datetime.now()
    next_date = now + timedelta(days=interval)
    next_review_at = next_date.strftime('%Y-%m-%d %H:%M:%S')

    return next_review_at, interval, round(ef, 2), count


def get_review_forecast(questions, days=30):
    """
    预测未来 days 天内的复习量分布
    返回 { 'YYYY-MM-DD': count }
    """
    from collections import Counter
    forecast = Counter()
    now = datetime.now()
    deadline = now + timedelta(days=days)

    for q in questions:
        ef = q.get('ease_factor', 2.5)
        interval = q.get('review_interval', 0)
        count = q.get('review_count', 0)

        # 找到首次未来到期日
        try:
            next_dt = datetime.strptime(q['next_review_at'], '%Y-%m-%d %H:%M:%S')
        except (ValueError, KeyError):
            next_dt = now

        cursor = next_dt if next_dt > now else now

        # 在 30 天窗口内逐次模拟复习排期
        while cursor <= deadline:
            date_key = cursor.strftime('%Y-%m-%d')
            forecast[date_key] = forecast.get(date_key, 0) + 1

            # 模拟一次正确复习，计算下次到期日
            count += 1
            if count == 1:
                interval = 1
            elif count == 2:
                interval = 6
            else:
                interval = round(interval * ef)
            # 防止间隔过大导致 timedelta 溢出
            if interval > 365:
                interval = 365
            cursor += timedelta(days=interval)

    return dict(sorted(forecast.items()))
