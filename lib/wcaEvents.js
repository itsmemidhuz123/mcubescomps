export const WCA_EVENTS = [
    { id: '333', name: '3x3x3', displayName: '3x3x3' },
    { id: '222', name: '2x2x2', displayName: '2x2x2' },
    { id: '444', name: '4x4x4', displayName: '4x4x4' },
    { id: '555', name: '5x5x5', displayName: '5x5x5' },
    { id: '666', name: '6x6x6', displayName: '6x6x6' },
    { id: '777', name: '7x7x7', displayName: '7x7x7' },
    { id: '333bf', name: '3x3x3 Blindfolded', displayName: '3x3x3 BLD' },
    { id: '333fm', name: '3x3x3 Fewest Moves', displayName: '3x3x3 FMC' },
    { id: '333oh', name: '3x3x3 One-Handed', displayName: '3x3x3 OH' },
    { id: 'clock', name: 'Clock', displayName: 'Clock' },
    { id: 'minx', name: 'Megaminx', displayName: 'Megaminx' },
    { id: 'pyram', name: 'Pyraminx', displayName: 'Pyraminx' },
    { id: 'skewb', name: 'Skewb', displayName: 'Skewb' },
    { id: 'sq1', name: 'Square-1', displayName: 'Square-1' },
    { id: '444bf', name: '4x4x4 Blindfolded', displayName: '4x4x4 BLD' },
    { id: '555bf', name: '5x5x5 Blindfolded', displayName: '5x5x5 BLD' },
    { id: '333mbf', name: '3x3x3 Multi-Blind', displayName: '3x3x3 MBLD' }
];

export function getEventName(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    return event ? event.name : eventId;
}

export function getEventDisplayName(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    return event ? event.displayName : eventId;
}

export function getEventIcon(eventId, size = 20) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    const id = event ? event.id : '333';
    return `<img src="/icons/${id}.svg" alt="${eventId}" width="${size}" height="${size}" class="inline-block align-middle dark:invert" style="width:${size}px;height:${size}px;" />`;
}

export function getEventIconUrl(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    const id = event ? event.id : '333';
    return `/icons/${id}.svg`;
}