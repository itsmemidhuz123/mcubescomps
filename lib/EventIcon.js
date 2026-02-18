'use client';

import { WCA_EVENTS } from './wcaEvents';

export function EventIcon({ eventId, size = 20, className = '' }) {
    const event = WCA_EVENTS.find(e => e.id === eventId);
    const id = event ? event.id : '333';
    const displayName = event ? event.displayName : eventId;

    return (
        <img
            src={`/icons/${id}.svg`}
            alt={displayName}
            width={size}
            height={size}
            className={`inline-block align-middle ${className}`}
            style={{ width: size, height: size }}
        />
    );
}

export default EventIcon;