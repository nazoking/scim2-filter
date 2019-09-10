import * as toknizer from "./parser";
import * as tester from "./tester";

/** Filter is filter ast object. There is extends [Operation] */
export type Filter = AttrExp | LogExp | ValuePath | NotFilter;
// type ValFilter = AttrExp | LogExp | NotFilter;
export type AttrExp = Suffix | Compare;
// interface NotValFilter{
// 	valFilter: ValFilter;
// }
/** Operation has op */
export interface Operation {
  op: string;
}
export interface ValuePath extends Operation {
  op: "[]";
  attrPath: AttrPath;
  valFilter: Filter;
}
export interface NotFilter extends Operation {
  op: "not";
  filter: Filter;
}
export interface Compare extends Operation {
  op: "eq" | "ne" | "co" | "sw" | "ew" | "gt" | "lt" | "ge" | "le";
  attrPath: AttrPath;
  compValue: boolean | null | number | string;
}
export interface Suffix extends Operation {
  op: "pr";
  attrPath: AttrPath;
}
export interface LogExp extends Operation {
  op: "and" | "or";
  filters: Filter[];
}
export type AttrPath = string; // [URL ":"]?attrName("."subAttr)*

export const Tester = tester.Tester;
export type Tester = tester.Tester;

export function filter(filter: Filter): (r: any) => boolean {
  const tester = new Tester();
  return (r: any) => tester.test(r, filter);
}
export function parse(query: string): Filter {
  const l = new toknizer.Tokens(toknizer.tokenizer(query));
  const filter = toknizer.parseFilter(l);
  if (l.peek().type !== "EOT") {
    throw new Error(`unexpected EOT ${l.getList()}`);
  }
  return filter;
}
export function flatten(f: Filter): Filter {
  const valfilter = (f: Filter, path?: string): Filter => {
    if (path && "attrPath" in f) {
      f = { ...f, attrPath: `${path}.${f.attrPath}` };
    }
    switch (f.op) {
      case "and":
      case "or":
        return { ...f, filters: f.filters.map(c => valfilter(c, path)) };
      case "not":
        return { ...f, filter: valfilter(f, path) };
      case "[]":
        return valfilter(f.valFilter, f.attrPath);
    }
    return f;
  };
  // 1 and 2 or (1 or b) => 1 and 2 or 1 or b
  const log = (f: Filter): Filter => {
    switch (f.op) {
      case "and":
      case "or":
        const filters = f.filters.map(log);
        const result: Filter[] = [];
        filters.forEach(c => {
          if (c.op == f.op) {
            c.filters.forEach(cc => result.push(cc));
          } else {
            result.push(c);
          }
        });
        return { ...f, filters: result };
    }
    return f;
  };
  return log(valfilter(f));
}
