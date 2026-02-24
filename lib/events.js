export const WCA_EVENTS = [
    {
        id: '333',
        name: '3x3',
        fullName: '3x3 Cube',
        icon: '3×3',
        scrambleType: '333',
        category: 'cube'
    },
    {
        id: '222',
        name: '2x2',
        fullName: '2x2 Cube',
        icon: '2×2',
        scrambleType: '222',
        category: 'cube'
    },
    {
        id: '444',
        name: '4x4',
        fullName: '4x4 Cube',
        icon: '4×4',
        scrambleType: '444',
        category: 'cube'
    },
    {
        id: '555',
        name: '5x5',
        fullName: '5x5 Cube',
        icon: '5×5',
        scrambleType: '555',
        category: 'cube'
    },
    {
        id: '666',
        name: '6x6',
        fullName: '6x6 Cube',
        icon: '6×6',
        scrambleType: '666',
        category: 'bigcube'
    },
    {
        id: '777',
        name: '7x7',
        fullName: '7x7 Cube',
        icon: '7×7',
        scrambleType: '777',
        category: 'bigcube'
    },
    {
        id: 'pyram',
        name: 'Pyraminx',
        fullName: 'Pyraminx',
        icon: 'Pyr',
        scrambleType: 'pyram',
        category: 'special'
    },
    {
        id: 'skewb',
        name: 'Skewb',
        fullName: 'Skewb',
        icon: 'Skw',
        scrambleType: 'skewb',
        category: 'special'
    },
    {
        id: 'sq1',
        name: 'Square-1',
        fullName: 'Square-1',
        icon: 'Sq1',
        scrambleType: 'sq1',
        category: 'special'
    },
    {
        id: 'clock',
        name: 'Clock',
        fullName: 'Clock',
        icon: 'Clk',
        scrambleType: 'clock',
        category: 'special'
    },
    {
        id: 'minx',
        name: 'Megaminx',
        fullName: 'Megaminx',
        icon: 'Minx',
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