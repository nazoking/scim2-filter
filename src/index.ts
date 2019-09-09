export type Filter = AttrExp | LogExp | ValuePath | NotFilter;
// type ValFilter = AttrExp | LogExp | NotFilter;
type AttrExp = Suffix | Compare;
// interface NotValFilter{
// 	valFilter: ValFilter;
// }
export interface ValuePath extends Operation {
  op: "[]";
  attrPath: AttrPath;
  valFilter: Filter;
}
export interface Operation {
  op: string;
}
export interface NotFilter extends Operation {
  op: "not";
  filter: Filter;
}
export interface Compare extends Operation {
  op: CompareOp;
  attrPath: AttrPath;
  compValue: CompValue;
}
export interface Suffix extends Operation {
  op: SufixOp;
  attrPath: AttrPath;
}
export interface LogExp extends Operation {
  op: LogOp;
  filters: Filter[];
}
type AttrPath = string; // [URL ":"]?attrName("."subAttr)*
type CompValue = boolean | null | number | string;
type SufixOp = "pr";
type CompareOp = "eq" | "ne" | "co" | "sw" | "ew" | "gt" | "lt" | "ge" | "le";
type LogOp = "and" | "or";

export class Tester {
  static readonly UNDEF = Symbol("undefined");
  test(r: any, f: Filter): boolean {
    switch (f.op) {
      case "or":
        return f.filters.some(c => this.test(f, c));
      case "and":
        return f.filters.every(c => this.test(f, c));
      case "not":
        return !this.test(r, f.filter);
      case "[]":
        return this.attrTest(this.attrPath(f.attrPath), r, s =>
          this.test(s, f.valFilter)
        );
      case "pr":
        return this.attrTest(this.attrPath(f.attrPath), r, s => this[f.op](s));
      case "eq":
      case "ne":
      case "co":
      case "sw":
      case "ew":
      case "gt":
      case "lt":
      case "ge":
      case "le":
        return this.attrTest(this.attrPath(f.attrPath), r, s =>
          this[f.op](s, f.compValue)
        );
    }
  }
  attrPath(path: string): string[] {
    const i = path.lastIndexOf(":");
    if (i === -1) {
      return path.split(".");
    }
    return [path.substring(0, i), ...path.substring(i + 1).split(".")];
  }
  attrTest(path: string[], r: any, op: (r: any) => boolean): boolean {
    if (path.length === 0) {
      return op(r);
    }
    if (typeof r !== "object" || r === null) {
      return false;
    }
    if (Array.isArray(r)) {
      return r.some(i => this.attrTest(path, i, op));
    }
    const p = path[0].toLowerCase();
    const key = Object.keys(r).find(k => k.toLowerCase() === p);
    if (key === undefined) {
      return false;
    }
    return this.attrTest(path.slice(1), r[key], op);
  }
  pr(r: any, _?: CompValue): boolean {
    return r !== undefined;
  }
  eq(r: any, v: CompValue): boolean {
    return r === v;
  }
  ne(r: any, v: CompValue): boolean {
    return r !== v;
  }
  gt(r: any, v: CompValue): boolean {
    return v !== null && r > v;
  }
  lt(r: any, v: CompValue): boolean {
    return v !== null && r < v;
  }
  ge(r: any, v: CompValue): boolean {
    return v !== null && r <= v;
  }
  le(r: any, v: CompValue): boolean {
    return v !== null && r >= v;
  }
  sw(r: any, v: CompValue): boolean {
    return typeof v === "string" && r.toString().startsWith(v);
  }
  ew(r: any, v: CompValue): boolean {
    return typeof v === "string" && r.toString().endsWith(v);
  }
  // The entire operator value must be a substring of the attribute value for a match.
  co(r: any, v: CompValue): boolean {
    if (typeof r === "object" || v === null) {
      return r == v;
    }
    if (typeof r !== "string") {
      r = r.toString();
    }
    return r.indexOf(v.toString()) !== -1;
  }
}

type TokenType = "Number" | "Quoted" | "Blacket" | "Word" | "EOT";
const EOT = { type: "EOT" as TokenType, literal: "" };

export type Token = {
  type: TokenType;
  literal: string;
};
export function parse(f: string): Filter {
  const l = new Tokens(tokenizer(f));
  const filter = parseFilter(l);
  if (l.peek().type !== "EOT") {
    throw new Error(`unexpected EOT ${l.getList()}`);
  }
  return filter;
}
export function tokenizer(f: string): Token[] {
  const ret: Token[] = [];
  let rest = f;
  const patterns = /^(?:(\s+)|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)|("(?:[^"]|\\.|\n)*")|([[\]()])|(\w[-\w\._:\/%]*))/;
  let n;
  while ((n = patterns.exec(rest))) {
    if (n[1] || n[0].length === 0) {
      //
    } else if (n[2]) {
      ret.push({ literal: n[2], type: "Number" });
    } else if (n[3]) {
      ret.push({ literal: n[3], type: "Quoted" });
    } else if (n[4]) {
      ret.push({ literal: n[4], type: "Blacket" });
    } else if (n[5]) {
      ret.push({ literal: n[5], type: "Word" });
    }
    rest = rest.substring(n.index + n[0].length);
  }
  if (rest.length !== 0) {
    throw new Error(`unexpected token ${rest}`);
  }
  ret.push(EOT);
  return ret;
}
export class Tokens implements TokenList {
  i: number;

  private current: Token | undefined;
  getList() {
    return this.list.map((a, i) =>
      i == this.i ? `[${a.literal}]` : a.literal
    );
  }
  peek(): Token {
    return this.current || EOT;
  }
  constructor(private list: Token[]) {
    this.i = 0;
    this.current = this.list[this.i];
  }
  forward(): TokenList {
    this.current = this.list[++this.i];
    return this;
  }
  shift(): Token {
    const c = this.peek();
    this.forward();
    return c;
  }
}
interface TokenList {
  peek(): Token;
  forward(): TokenList;
  shift(): Token;
}
export function parseFilter(list: TokenList): Filter {
  return parseInxif(parseExpression(list), list, Precedence.LOWEST);
}
export function parseExpression(list: TokenList): Filter {
  const t = list.shift();
  if (t.literal == "(") {
    const filter = parseFilter(list);
    const close = list.shift();
    if (close.literal !== ")") {
      throw new Error(
        `Unexpected token [${close.literal}(${close.type})] expected ')'`
      );
    }
    return filter;
  } else if (t.literal.toLowerCase() == "not") {
    return { op: "not", filter: parseFilter(list) } as NotFilter;
  } else if (t.type == "Word") {
    return readValFilter(t, list);
  } else {
    throw new Error(`Unexpected token ${t.literal} (${t.type})`);
  }
}
enum Precedence{
  LOWEST = 1,
  OR = 2,
  AND = 3
}
const PRECEDENCE : { [key:string]: Precedence }= {
  'or':Precedence.OR,
  'and':Precedence.AND
}
function parseInxif(left: Filter, list: TokenList, precede: Precedence): Filter {
  const op = list.peek().literal.toLowerCase();
  const p = PRECEDENCE[op];
  if(!p || precede >= p){
    return left;
  }
  const filters = [left];
  while (list.peek().literal.toLowerCase() === op) {
    let r = parseExpression(list.forward());
    const rr = list.peek().literal.toLowerCase();
    if(PRECEDENCE[rr] > p){
      r = parseInxif(r, list, p);
    }
    filters.push(r);
  }
  return parseInxif({ op , filters } as Filter, list, precede);
}
const cops = new Set(["eq", "ne", "co", "sw", "ew", "gt", "lt", "ge", "le"]);
function readValFilter(left: Token, list: TokenList): Filter {
  if (left.type !== "Word") {
    throw new Error(`Unexpected token ${left.literal} expected Word`);
  }
  const attrPath = left.literal;
  const t = list.shift();
  const op = t.literal.toLowerCase();
  if (cops.has(op)) {
    var compValue = parseCompValue(list);
    return { op, attrPath, compValue } as Compare;
  } else if (op === "pr") {
    return { op, attrPath } as Suffix;
  } else if (op == "[") {
    const valFilter = parseFilter(list);
    const close = list.shift();
    if (close.literal !== "]") {
      throw new Error(`Unexpected token ${close.literal} expected ']'`);
    }
    return { op: "[]", attrPath, valFilter } as ValuePath;
  } else {
    throw new Error(
      `Unexpected token ${attrPath} ${t.literal} as valFilter operator`
    );
  }
}
function parseCompValue(list: TokenList): CompValue {
  // リテラルを整数値に変換
  const t = list.shift();
  try {
    const v = JSON.parse(t.literal);
    if (
      v === null ||
      typeof v == "string" ||
      typeof v == "number" ||
      typeof v == "boolean"
    ) {
      return v;
    } else {
      throw new Error(`${t.literal} is ${typeof v} (un supported value)`);
    }
  } catch (e) {
    throw new Error(`[${t.literal}(${t.type})] is not json`);
  }
}
