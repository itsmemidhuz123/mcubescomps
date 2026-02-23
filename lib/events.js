export const WCA_EVENTS = [
    {
        id: '333',
        name: '3x3',
        fullName: '3x3 Cube',
        icon: '🧊',
        scrambleType: '333',
        category: 'cube'
    },
    {
        id: '222',
        name: '2x2',
        fullName: '2x2 Cube',
        icon: '🎲',
        scrambleType: '222',
        category: 'cube'
    },
    {
        id: '444',
        name: '4x4',
        fullName: '4x4 Cube',
        icon: '📦',
        scrambleType: '444',
        category: 'cube'
    },
    {
        id: '555',
        name: '5x5',
        fullName: '5x5 Cube',
        icon: '🎁',
        scrambleType: '555',
        category: 'cube'
    },
    {
        id: '666',
        name: '6x6',
        fullName: '6x6 Cube',
        icon: '📦',
        scrambleType: '666',
        category: 'bigcube'
    },
    {
        id: '777',
        name: '7x7',
        fullName: '7x7 Cube',
        icon: '📦',
        scrambleType: '777',
        category: 'bigcube'
    },
    {
        id: 'pyram',
        name: 'Pyraminx',
        fullName: 'Pyraminx',
        icon: '🔺',
        scrambleType: 'pyram',
        category: 'special'
    },
    {
        id: 'skewb',
        name: 'Skewb',
        fullName: 'Skewb',
        icon: '💎',
        scrambleType: 'skewb',
        category: 'special'
    },
    {
        id: 'sq1',
        name: 'Square-1',
        fullName: 'Square-1',
        icon: '⬡',
        scrambleType: 'sq1',
        category: 'special'
    },
    {
        id: 'clock',
        name: 'Clock',
        fullName: 'Clock',
        icon: '🕐',
        scrambleType: 'clock',
        category: 'special'
    },
    {
        id: 'minx',
        name: 'Megaminx',
        fullName: 'Megaminx',
        icon: '⭐',
        scrambleType: 'minx',
        category: 'special'
    }
];

export const getEventById = (eventId) => {
    return WCA_EVENTS.find(e => e.id === eventId) || WCA_EVENTS[0];
};

export const getEventsByCategory = (category) => {
    return WCA_EVENTS.filter(e => e.category === category);
};

export const DEFAULT_EVENT = WCA_EVENTS[0];