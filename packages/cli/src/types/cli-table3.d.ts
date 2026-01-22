declare module 'cli-table3' {
  interface TableOptions {
    head?: string[];
    style?: {
      head?: string[];
      border?: string[];
      compact?: boolean;
    };
    wordWrap?: boolean;
    colWidths?: number[];
  }

  class Table {
    constructor(options?: TableOptions);
    push(row: (string | number)[]): void;
    toString(): string;
  }

  export = Table;
}

