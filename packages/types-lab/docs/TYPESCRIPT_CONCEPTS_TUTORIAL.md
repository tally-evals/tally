# TypeScript Concepts Tutorial

This document explains the TypeScript concepts used in the type-safe reports solution.
Each concept is explained with simple examples, then shown in context.

---

## Table of Contents

1. [Literal Types](#1-literal-types)
2. [Generic Type Parameters](#2-generic-type-parameters)
3. [The `const` Type Parameter Modifier](#3-the-const-type-parameter-modifier)
4. [Conditional Types](#4-conditional-types)
5. [The `infer` Keyword](#5-the-infer-keyword)
6. [Mapped Types](#6-mapped-types)
7. [The `Extract` Utility Type](#7-the-extract-utility-type)
8. [The `keyof` Operator](#8-the-keyof-operator)
9. [Discriminated Unions](#9-discriminated-unions)
10. [Branded Types](#10-branded-types)
11. [Type-Level Assertions](#11-type-level-assertions)
12. [Index Signatures vs Mapped Types](#12-index-signatures-vs-mapped-types)
13. [Putting It All Together](#13-putting-it-all-together)

---

## 1. Literal Types

### What Are They?

Literal types are types that represent a specific value, not just a category.

```typescript
// Regular types - represent categories
let name: string = "alice";  // Can be any string
let age: number = 30;        // Can be any number

// Literal types - represent specific values
let status: "active" | "inactive" = "active";  // Can ONLY be "active" or "inactive"
let zero: 0 = 0;                                // Can ONLY be 0
```

### Why Do They Matter?

Literal types enable precise type checking:

```typescript
// With string type - no autocomplete, no error checking
function setStatus(status: string) { }
setStatus("actve");  // Typo not caught! ❌

// With literal type - autocomplete works, typos caught
function setStatus(status: "active" | "inactive") { }
setStatus("actve");  // Error: "actve" is not assignable ✅
```

### In Our Solution

We use literal types for eval names:

```typescript
// The name "relevance" is a literal type, not just string
const relevanceEval = {
  name: "relevance" as const,  // Type: "relevance"
  kind: "singleTurn",
};

// This enables typed access:
report.result.singleTurn.relevance;  // ✅ Autocomplete works
report.result.singleTurn.relevanc;   // ❌ Error: typo caught
```

---

## 2. Generic Type Parameters

### What Are They?

Generics let you write reusable code that works with many types while preserving type information.

```typescript
// Without generics - loses type info
function first(arr: unknown[]): unknown {
  return arr[0];
}
const x = first([1, 2, 3]);  // x is unknown ❌

// With generics - preserves type info
function first<T>(arr: T[]): T {
  return arr[0];
}
const x = first([1, 2, 3]);  // x is number ✅
```

### Type Parameter Constraints

You can constrain what types are allowed:

```typescript
// T must be a string (or narrower)
function greet<T extends string>(name: T): T {
  console.log(`Hello, ${name}`);
  return name;
}

greet("Alice");  // T inferred as "Alice" (literal)
greet(123);      // Error: number doesn't extend string
```

### In Our Solution

We use generics to preserve eval types through the pipeline:

```typescript
interface Tally<TEvals extends readonly Eval[]> {
  readonly evals: TEvals;
  run(): Promise<TallyRunReport<TEvals>>;
}
```

---

## 3. The `const` Type Parameter Modifier

### The Problem

By default, TypeScript widens literal types in certain contexts:

```typescript
function process<T extends string>(name: T): T {
  return name;
}

// Direct call - literal preserved
const x = process("hello");  // x: "hello" ✅

// Inside array - literal widened to string!
function processArray<T extends readonly string[]>(arr: T): T {
  return arr;
}
const arr = processArray(["a", "b"]);  // arr: string[] ❌ (not ["a", "b"])
```

### The Solution: `const` Modifier

TypeScript 5.0 introduced `const` type parameters:

```typescript
// WITHOUT const - literals widened
function processArray<T extends readonly string[]>(arr: T): T {
  return arr;
}
const arr = processArray(["a", "b"]);
// Type: string[]  ❌

// WITH const - literals preserved
function processArray<const T extends readonly string[]>(arr: T): T {
  return arr;
}
const arr = processArray(["a", "b"]);
// Type: readonly ["a", "b"]  ✅
```

### Critical Discovery in Our Solution

We found that `const` must be on BOTH the factory functions AND createTally:

```typescript
// Factory function - const preserves name literal
function defineSingleTurnEval<
  const TName extends string,  // ← const here!
  TValue extends MetricScalar,
>(args: { name: TName; ... }): SingleTurnEval<TName, TValue> { ... }

// createTally - const preserves array structure
function createTally<
  const TEvals extends readonly Eval[]  // ← const here too!
>(args: { evals: TEvals; ... }): Tally<TEvals> { ... }
```

**Why both are needed:**

```typescript
// Without const on factory:
const tally = createTally({
  evals: [
    defineSingleTurnEval({ name: "relevance", ... }),  // name becomes string!
  ]
});
// TEvals[0].name is string ❌

// With const on factory:
const tally = createTally({
  evals: [
    defineSingleTurnEval({ name: "relevance", ... }),  // name stays "relevance"
  ]
});
// TEvals[0].name is "relevance" ✅
```

---

## 4. Conditional Types

### What Are They?

Conditional types let you create types that depend on conditions:

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">;  // true
type B = IsString<123>;      // false
```

### Syntax

```typescript
T extends U ? X : Y
```

- If `T` is assignable to `U`, the type is `X`
- Otherwise, the type is `Y`

### Distributive Conditional Types

When the input is a union, conditionals distribute over each member:

```typescript
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
// Distributes: (string extends unknown ? string[] : never) | (number extends unknown ? number[] : never)
// Result: string[] | number[]
```

### In Our Solution

We use conditional types to extract value types:

```typescript
type ExtractValueType<E> = 
  E extends { kind: "singleTurn" | "multiTurn"; metric: { valueType: infer VT } }
    ? VT extends "number" | "ordinal" ? number
    : VT extends "boolean" ? boolean
    : string
  : E extends { kind: "scorer" }
    ? number
    : MetricScalar;
```

---

## 5. The `infer` Keyword

### What Is It?

`infer` lets you extract and name a type from within another type:

```typescript
// Extract the return type of a function
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;  // string
type B = ReturnType<() => number>;  // number
```

### How It Works

1. TypeScript tries to match the pattern
2. If it matches, the `infer`red type is bound to the variable
3. That variable can be used in the "true" branch

```typescript
// Extract the element type of an array
type ElementType<T> = T extends (infer E)[] ? E : never;

type A = ElementType<string[]>;   // string
type B = ElementType<number[]>;   // number
type C = ElementType<string>;     // never (not an array)
```

### Multiple Inferences

You can have multiple `infer` declarations:

```typescript
type FunctionParts<T> = T extends (arg: infer A) => infer R 
  ? { arg: A; return: R } 
  : never;

type Parts = FunctionParts<(x: string) => number>;
// { arg: string; return: number }
```

### In Our Solution

We use `infer` to extract the name from an eval:

```typescript
type ExtractEvalName<E> = E extends { readonly name: infer N extends string }
  ? N
  : never;

// Usage:
type Name = ExtractEvalName<SingleTurnEval<"relevance", "metric", number>>;
// Name = "relevance"
```

Note the `infer N extends string` - this constrains the inferred type.

---

## 6. Mapped Types

### What Are They?

Mapped types create new types by transforming properties of existing types:

```typescript
// Make all properties optional
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// Make all properties readonly
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};
```

### Syntax

```typescript
type MappedType<T> = {
  [K in keyof T]: NewValueType;
};
```

- `K in keyof T` iterates over all keys of T
- For each key, you define what the value type should be

### Key Remapping (TypeScript 4.1+)

You can transform the keys themselves using `as`:

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Person = { name: string; age: number };
type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

### Filtering Keys

You can filter keys by remapping to `never`:

```typescript
// Only keep string properties
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

type Person = { name: string; age: number; email: string };
type StringProps = OnlyStrings<Person>;
// { name: string; email: string }
```

### In Our Solution

We use mapped types to build typed result structures:

```typescript
type TypedSingleTurnResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "singleTurn">]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<T, "singleTurn">, { name: K }>>
  >;
};
```

This creates an object type where:
- Keys are the names of single-turn evals (e.g., "relevance", "toxicity")
- Values are `SingleTurnEvalSeries` with the correct value type

---

## 7. The `Extract` Utility Type

### What Is It?

`Extract<T, U>` extracts from union `T` all members assignable to `U`:

```typescript
type T = "a" | "b" | "c" | 1 | 2;

type OnlyStrings = Extract<T, string>;  // "a" | "b" | "c"
type OnlyNumbers = Extract<T, number>;  // 1 | 2
```

### How It Works

`Extract` is defined as:

```typescript
type Extract<T, U> = T extends U ? T : never;
```

Because conditional types distribute over unions, each member is checked:

```typescript
Extract<"a" | "b" | 1, string>
// = ("a" extends string ? "a" : never) | ("b" extends string ? "b" : never) | (1 extends string ? 1 : never)
// = "a" | "b" | never
// = "a" | "b"
```

### In Our Solution

We use `Extract` to filter evals by their kind:

```typescript
type FilterByKind<T extends readonly Eval[], K extends string> = Extract<
  T[number],    // Union of all evals in the array
  { kind: K }   // Must have matching kind property
>;

// Usage:
type Evals = readonly [
  SingleTurnEval<"relevance", ...>,
  MultiTurnEval<"coherence", ...>,
  ScorerEval<"quality">,
];

type SingleTurnOnly = FilterByKind<Evals, "singleTurn">;
// SingleTurnEval<"relevance", ...>
```

---

## 8. The `keyof` Operator

### What Is It?

`keyof` gets a union of all keys of a type:

```typescript
type Person = { name: string; age: number; email: string };

type PersonKeys = keyof Person;  // "name" | "age" | "email"
```

### With Index Signatures

```typescript
type StringMap = { [key: string]: number };
type StringMapKeys = keyof StringMap;  // string

type NumberMap = { [key: number]: string };
type NumberMapKeys = keyof NumberMap;  // number
```

### In Our Solution

We use `keyof` to get valid keys for type assertions:

```typescript
type SingleTurnKeys = keyof typeof report.result.singleTurn;
// "relevance" | "toxicity"

// Type assertion that a key is valid
type AssertKeyExists<T, K extends string> = K extends keyof T ? true : never;

const _valid: AssertKeyExists<typeof report.result.singleTurn, "relevance"> = true;  // ✅
const _invalid: AssertKeyExists<typeof report.result.singleTurn, "typo"> = true;     // ❌ Error
```

---

## 9. Discriminated Unions

### What Are They?

Discriminated unions are unions where each member has a common property (the "discriminant") with a literal type:

```typescript
type Shape = 
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };
```

### Why Are They Useful?

TypeScript can narrow the type based on the discriminant:

```typescript
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      // TypeScript knows shape is { kind: "circle"; radius: number }
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      // TypeScript knows shape is { kind: "rectangle"; width: number; height: number }
      return shape.width * shape.height;
    case "triangle":
      return 0.5 * shape.base * shape.height;
  }
}
```

### In Our Solution

We use discriminated unions for eval types:

```typescript
type Eval = 
  | SingleTurnEval   // { kind: "singleTurn"; ... }
  | MultiTurnEval    // { kind: "multiTurn"; ... }
  | ScorerEval;      // { kind: "scorer"; ... }

// The `kind` property lets us filter by type:
type SingleTurnOnly = Extract<Eval, { kind: "singleTurn" }>;
```

---

## 10. Branded Types

### The Problem

TypeScript uses structural typing, so these are equivalent:

```typescript
type UserId = string;
type PostId = string;

function getUser(id: UserId) { ... }

const postId: PostId = "post-123";
getUser(postId);  // No error! Both are just strings ❌
```

### The Solution: Branded Types

Add a phantom property that exists only in the type system:

```typescript
type UserId = string & { readonly __brand: "UserId" };
type PostId = string & { readonly __brand: "PostId" };

// Create branded values
function createUserId(id: string): UserId {
  return id as UserId;
}

function createPostId(id: string): PostId {
  return id as PostId;
}

function getUser(id: UserId) { ... }

const postId = createPostId("post-123");
getUser(postId);  // Error: PostId is not assignable to UserId ✅
```

### In Our Solution

We use a branded type for scores:

```typescript
type Score = number & { readonly __brand: "Score" };

// Scores can only be created intentionally
const score = 0.85 as Score;

// This ensures scores aren't confused with raw numbers
interface Measurement {
  score?: Score;      // Branded - normalized 0-1 value
  rawValue?: number;  // Regular number - any value
}
```

---

## 11. Type-Level Assertions

### What Are They?

Type-level assertions are compile-time checks that verify type relationships:

```typescript
// Assert that A extends B
type Assert<A, B> = A extends B ? true : never;

// If this compiles, the assertion passes
const _check: Assert<"hello", string> = true;  // ✅

// If this errors, the assertion fails
const _check: Assert<number, string> = true;   // ❌ Error: true not assignable to never
```

### Common Patterns

```typescript
// Assert key exists in type
type AssertKeyExists<T, K extends string> = K extends keyof T ? true : never;

// Assert key does NOT exist
type AssertKeyMissing<T, K extends string> = K extends keyof T ? never : true;

// Assert types are equal
type AssertEqual<A, B> = A extends B ? (B extends A ? true : never) : never;
```

### In Our Solution

We use type assertions to verify our mapped types work correctly:

```typescript
// Assert "relevance" is a valid key
const _valid: AssertKeyExists<typeof report.result.singleTurn, "relevance"> = true;

// Assert "typo" is NOT a valid key
const _invalid: AssertKeyMissing<typeof report.result.singleTurn, "typo"> = true;

// Assert there's no index signature (string shouldn't be a valid key)
const _noIndex: (string extends keyof typeof report.result.singleTurn ? true : false) extends false
  ? true
  : never = true;
```

---

## 12. Index Signatures vs Mapped Types

### Index Signatures

Allow any string (or number) key:

```typescript
type StringDict = {
  [key: string]: number;
};

const dict: StringDict = {};
dict.anything = 42;     // ✅ Any key is allowed
dict.whatever = 100;    // ✅
```

**Problem:** No type safety for specific keys.

### Mapped Types with Specific Keys

Only allow specific keys:

```typescript
type SpecificDict = {
  [K in "a" | "b" | "c"]: number;
};

const dict: SpecificDict = { a: 1, b: 2, c: 3 };
dict.d = 4;  // ❌ Error: 'd' doesn't exist
```

**Advantage:** Full type safety with autocomplete.

### The Bracket Notation Gotcha

TypeScript behaves differently with bracket vs dot notation:

```typescript
type MyType = { a: number; b: string };

declare const obj: MyType;

obj.c;        // ❌ Error: Property 'c' does not exist
obj["c"];     // ⚠️ May not error depending on config! Returns undefined

// Solution: Use typed accessor
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

get(obj, "c");  // ❌ Error: "c" is not assignable to "a" | "b"
```

### In Our Solution

We create mapped types with specific keys (eval names):

```typescript
type TypedSingleTurnResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "singleTurn">]: SingleTurnEvalSeries<...>;
};

// Result for evals ["relevance", "toxicity"]:
// { readonly relevance: SingleTurnEvalSeries<number>; readonly toxicity: SingleTurnEvalSeries<boolean> }
```

And provide a typed accessor for safety:

```typescript
function getTyped<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

getTyped(report.result.singleTurn, "relevance");  // ✅
getTyped(report.result.singleTurn, "typo");       // ❌ Error
```

---

## 13. Putting It All Together

Here's how all these concepts combine in our solution:

### Step 1: Define Eval Types with Generic Name

```typescript
interface EvalBase<TName extends string = string> {
  readonly name: TName;  // Literal type preserved
}

interface SingleTurnEval<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  readonly kind: "singleTurn";  // Discriminant
  readonly metric: { valueType: ValueTypeFor<TValue> };
}
```

### Step 2: Factory with `const` Preserves Literals

```typescript
function defineSingleTurnEval<
  const TName extends string,  // const preserves literal
  TValue extends MetricScalar,
>(args: {
  name: TName;
  ...
}): SingleTurnEval<TName, TValue> {
  return { kind: "singleTurn", name: args.name, ... };
}
```

### Step 3: Extract Names Using Conditional Types + Infer

```typescript
type ExtractEvalName<E> = E extends { readonly name: infer N extends string }
  ? N
  : never;
```

### Step 4: Filter by Kind Using Extract

```typescript
type FilterByKind<T extends readonly Eval[], K extends string> = Extract<
  T[number],
  { kind: K }
>;

type EvalNamesOfKind<T extends readonly Eval[], K extends string> = 
  ExtractEvalName<FilterByKind<T, K>>;
```

### Step 5: Build Typed Results with Mapped Types

```typescript
type TypedSingleTurnResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "singleTurn">]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<T, "singleTurn">, { name: K }>>
  >;
};
```

### Step 6: Thread Types Through API

```typescript
function createTally<const TEvals extends readonly Eval[]>(args: {
  evals: TEvals;
}): Tally<TEvals> { ... }

interface Tally<TEvals extends readonly Eval[]> {
  run(): Promise<TallyRunReport<TEvals>>;
}

interface TallyRunReport<TEvals extends readonly Eval[]> {
  result: TypedConversationResult<TEvals>;
}
```

### The Result

```typescript
const tally = createTally({
  evals: [
    defineSingleTurnEval({ name: "relevance", metric: numberMetric }),
    defineSingleTurnEval({ name: "toxicity", metric: booleanMetric }),
  ],
});

const report = await tally.run();

report.result.singleTurn.relevance;     // ✅ Autocomplete
report.result.singleTurn.toxicity;      // ✅ Works
report.result.singleTurn.relevanc;      // ❌ Error: typo

const raw = report.result.singleTurn.relevance.byStepIndex[0]?.measurement.rawValue;
// raw: number | null | undefined  ✅ Correct type!
```

---

## Quick Reference

| Concept | Syntax | Purpose |
|---------|--------|---------|
| Literal Types | `"value"` | Exact value types |
| Generic Type | `<T>` | Parameterized types |
| `const` Modifier | `<const T>` | Preserve literals in inference |
| Conditional | `T extends U ? X : Y` | Type-level if/else |
| `infer` | `T extends X<infer U>` | Extract types from patterns |
| Mapped Type | `{ [K in Keys]: Value }` | Transform object types |
| `Extract` | `Extract<T, U>` | Filter union members |
| `keyof` | `keyof T` | Get keys as union |
| Discriminated Union | `{ kind: "a" } \| { kind: "b" }` | Tagged unions |
| Branded Type | `T & { __brand: X }` | Nominal typing |
| Type Assertion | `A extends B ? true : never` | Compile-time checks |

---

## Further Reading

- [TypeScript Handbook: Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook: Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript Handbook: Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
- [TypeScript 5.0: const Type Parameters](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#const-type-parameters)
