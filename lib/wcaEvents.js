import React from 'react';

const WCA_CDN_BASE = 'https://cdn.cubing.net/v0/events';

export const WCA_EVENTS = [
    { id: '333', name: '3x3x3', displayName: '3x3x3', iconUrl: `${WCA_CDN_BASE}/333.svg` },
    { id: '222', name: '2x2x2', displayName: '2x2x2', iconUrl: `${WCA_CDN_BASE}/222.svg` },
    { id: '444', name: '4x4x4', displayName: '4x4x4', iconUrl: `${WCA_CDN_BASE}/444.svg` },
    { id: '555', name: '5x5x5', displayName: '5x5x5', iconUrl: `${WCA_CDN_BASE}/555.svg` },
    { id: '666', name: '6x6x6', displayName: '6x6x6', iconUrl: `${WCA_CDN_BASE}/666.svg` },
    { id: '777', name: '7x7x7', displayName: '7x7x7', iconUrl: `${WCA_CDN_BASE}/777.svg` },
    { id: '333bf', name: '3x3x3 Blindfolded', displayName: '3x3x3 BLD', iconUrl: `${WCA_CDN_BASE}/333bf.svg` },
    { id: '333fm', name: '3x3x3 Fewest Moves', displayName: '3x3x3 FMC', iconUrl: `${WCA_CDN_BASE}/333fm.svg` },
    { id: '333oh', name: '3x3x3 One-Handed', displayName: '3x3x3 OH', iconUrl: `${WCA_CDN_BASE}/333oh.svg` },
    { id: 'clock', name: 'Clock', displayName: 'Clock', iconUrl: `${WCA_CDN_BASE}/clock.svg` },
    { id: 'minx', name: 'Megaminx', displayName: 'Megaminx', iconUrl: `${WCA_CDN_BASE}/minx.svg` },
    { id: 'pyram', name: 'Pyraminx', displayName: 'Pyraminx', iconUrl: `${WCA_CDN_BASE}/pyram.svg` },
    { id: 'skewb', name: 'Skewb', displayName: 'Skewb', iconUrl: `${WCA_CDN_BASE}/skewb.svg` },
    { id: 'sq1', name: 'Square-1', displayName: 'Square-1', iconUrl: `${WCA_CDN_BASE}/sq1.svg` },
    { id: '444bf', name: '4x4x4 Blindfolded', displayName: '4x4x4 BLD', iconUrl: `${WCA_CDN_BASE}/444bf.svg` },
    { id: '555bf', name: '5x5x5 Blindfolded', displayName: '5x5x5 BLD', iconUrl: `${WCA_CDN_BASE}/555bf.svg` },
    { id: '333mbf', name: '3x3x3 Multi-Blind', displayName: '3x3x3 MBLD', iconUrl: `${WCA_CDN_BASE}/333mbf.svg` }
];

export function getEventName(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    return event ? event.name : eventId;
}

export function getEventDisplayName(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    return event ? event.displayName : eventId;
}

export function getEventIconUrl(eventId) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    return event ? event.iconUrl : `${WCA_CDN_BASE}/333.svg`;
}

export function getEventIcon(eventId, size = 20) {
    const iconUrl = getEventIconUrl(eventId);
    const displayName = getEventDisplayName(eventId);
    return React.createElement('img', {
        src: iconUrl,
        alt: displayName,
        width: size,
        height: size,
        className: 'inline-block align-middle',
        style: { width: size, height: size }
    });
}