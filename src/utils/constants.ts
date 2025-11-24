
export const SLIDER_DESCRIPTIONS = {
    p: {
        1: '极度困倦',
        2: '困倦',
        3: '疲惫',
        4: '乏力',
        5: '清醒',
        6: '精神',
        7: '充沛',
        8: '活跃',
        9: '激昂',
        10: '亢奋'
    },
    c: {
        1: '涣散',
        2: '混乱',
        3: '迟钝',
        4: '分心',
        5: '专注',
        6: '清晰',
        7: '敏锐',
        8: '洞察',
        9: '觉醒',
        10: '心流'
    },
    s: {
        1: '贤者',
        2: '冷淡',
        3: '平静',
        4: '安稳',
        5: '萌动',
        6: '渴望',
        7: '冲动',
        8: '燥热',
        9: '狂野',
        10: '原始'
    }
} as const;

export const UI_TEXT = {
    tabs: {
        record: '记录',
        analytics: '分析',
        chat: '对话',
        calendar: '日历'
    },
    record: {
        save: '记录状态',
        saving: '记录中...',
        saved: '已记录',
        trend: {
            up: '上升',
            flat: '平稳',
            down: '下降'
        },
        tagsPlaceholder: '添加标签 (用逗号分隔)...',
        notePlaceholder: '添加备注...'
    },
    analytics: {
        title: '状态分析',
        timeRange: '最近 24 小时',
        noData: '暂无数据'
    },
    chat: {
        placeholder: '输入消息...',
        send: '发送',
        history: '历史记录',
        settings: '设置',
        apiKeyLabel: 'DeepSeek API Key',
        save: '保存',
        cancel: '取消'
    },
    calendar: {
        import: '导入 CSV',
        export: '导出 CSV',
        confirmDelete: '确定要删除这条记录吗？'
    }
};
