export class CubeEvent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.shortName = config.shortName;
    this.scrambleLength = config.scrambleLength || 20;
    this.inspectionTime = config.inspectionTime || 15;
    this.solvesCount = config.solvesCount || 5;
  }

  getScrambleCount() {
    return this.solvesCount;
  }

  getInspectionTime() {
    return this.inspectionTime;
  }

  validateScramble(scramble) {
    return typeof scramble === 'string' && scramble.length > 0;
  }
}

export class Cube333 extends CubeEvent {
  constructor() {
    super({
      id: '333',
      name: '3x3 Cube',
      shortName: '3x3',
      scrambleLength: 20,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Cube222 extends CubeEvent {
  constructor() {
    super({
      id: '222',
      name: '2x2 Cube',
      shortName: '2x2',
      scrambleLength: 11,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Cube444 extends CubeEvent {
  constructor() {
    super({
      id: '444',
      name: '4x4 Cube',
      shortName: '4x4',
      scrambleLength: 40,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Cube555 extends CubeEvent {
  constructor() {
    super({
      id: '555',
      name: '5x5 Cube',
      shortName: '5x5',
      scrambleLength: 60,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Pyraminx extends CubeEvent {
  constructor() {
    super({
      id: 'pyram',
      name: 'Pyraminx',
      shortName: 'Pyram',
      scrambleLength: 11,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Skewb extends CubeEvent {
  constructor() {
    super({
      id: 'skewb',
      name: 'Skewb',
      shortName: 'Skewb',
      scrambleLength: 11,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Square1 extends CubeEvent {
  constructor() {
    super({
      id: 'sq1',
      name: 'Square-1',
      shortName: 'Sq1',
      scrambleLength: 16,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Megaminx extends CubeEvent {
  constructor() {
    super({
      id: 'minx',
      name: 'Megaminx',
      shortName: 'Minx',
      scrambleLength: 70,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class Clock extends CubeEvent {
  constructor() {
    super({
      id: 'clock',
      name: 'Clock',
      shortName: 'Clock',
      scrambleLength: 14,
      inspectionTime: 15,
      solvesCount: 5,
    });
  }
}

export class EventEngine {
  static events = {
    '333': Cube333,
    '222': Cube222,
    '444': Cube444,
    '555': Cube555,
    'pyram': Pyraminx,
    'skewb': Skewb,
    'sq1': Square1,
    'minx': Megaminx,
    'clock': Clock,
  };

  static getEvent(eventId) {
    const EventClass = this.events[eventId];
    if (!EventClass) {
      return new Cube333();
    }
    return new EventClass();
  }

  static getEventList() {
    return [
      { id: '333', name: '3x3', icon: '⬜' },
      { id: '222', name: '2x2', icon: '🟦' },
      { id: '444', name: '4x4', icon: '🟧' },
      { id: '555', name: '5x5', icon: '🟥' },
      { id: 'pyram', name: 'Pyraminx', icon: '🔺' },
      { id: 'skewb', name: 'Skewb', icon: '💎' },
      { id: 'sq1', name: 'Square-1', icon: '🔳' },
      { id: 'minx', name: 'Megaminx', icon: '⬟' },
      { id: 'clock', name: 'Clock', icon: '🕐' },
    ];
  }

  static isValidEvent(eventId) {
    return eventId in this.events;
  }
}
