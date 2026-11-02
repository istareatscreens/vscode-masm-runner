import { styleTags, tags as t } from "@lezer/highlight";

export const masmHighlightSpec = {
  // keywords
  Mnemonic: t.keyword,
  "Instruction/OperatorKeyword Instruction/Attribute": t.keyword, // AND OR XOR NOT SHL SHR SYSCALL as instructions
  Prefix: t.modifier,
  Directive: t.controlKeyword,
  DotDirective: t.controlKeyword,
  "GenericDotDirective/DotWord": t.controlKeyword,
  DataType: t.typeName,
  OperatorKeyword: t.operatorKeyword,
  Attribute: t.modifier,
  // operands
  Register: t.special(t.variableName),
  FlagName: t.atom,
  PredefinedSymbol: t.macroName,
  AnonLabel: t.labelName,
  LocationCounter: t.atom,
  Uninitialized: t.atom,
  Number: t.number,
  Float: t.number,
  String: t.string,
  TextLiteral: t.special(t.string),
  FileName: t.string,
  RawText: t.docString,
  Identifier: t.variableName,
  DotWord: t.propertyName,
  // comments
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  // definitions and names (paths select the direct child only)
  "Label/Identifier": t.labelName,
  "ProcDirective/Identifier EndpDirective/Identifier ProtoDirective/Identifier":
    t.function(t.definition(t.variableName)),
  "MacroDirective/Identifier": t.definition(t.macroName),
  "MacroCall/Identifier": t.macroName,
  "MacroLabel/Identifier GotoDirective/Identifier": t.labelName,
  "DataDefinition/Identifier TypedDataDefinition/Identifier EqualsDirective/Identifier EquDirective/Identifier TextEquDirective/Identifier SizeStrDirective/Identifier SubStrDirective/Identifier InStrDirective/Identifier LabelDirective/Identifier":
    t.definition(t.variableName),
  "SegmentDirective/Identifier EndsDirective/Identifier GroupDirective/Identifier StructDirective/Identifier RecordDirective/Identifier TypedefDirective/Identifier":
    t.definition(t.typeName),
  "TypeName/Identifier QualifiedType/Identifier": t.typeName,
  "MacroFunctionCall/Identifier": t.function(t.variableName),
  "ExternItem/Identifier PublicItem/Identifier CommItem/Identifier":
    t.definition(t.variableName),
  "Parameter/Identifier LocalItem/Identifier MacroParameter/Identifier ProtoArg/Identifier BitField/Identifier":
    t.definition(t.local(t.variableName)),
  // punctuation and symbolic operators
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ",": t.separator,
  ": ::": t.punctuation,
  // styleTags treats "*", "/" and "!" as path syntax, so those token names are quoted.
  '= + - "*" "/" & && || % "!" "!=" == < <= > >=': t.operator,
};

export const masmHighlighting = styleTags(masmHighlightSpec);
