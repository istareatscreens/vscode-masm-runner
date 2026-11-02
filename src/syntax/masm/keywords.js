export const DIRECTIVES = [
  ["ALIAS", "kwAlias", "alias-masm.md"],
  ["ALIGN", "kwAlign", "align-masm.md"], // also segment.md: ALIGN(n)
  ["ASSUME", "kwAssume", "assume.md"],
  ["CATSTR", "kwCatstr", "catstr.md"],
  ["COMM", "kwComm", "comm.md"],
  ["COMMENT", "kwComment", "comment-masm.md"],
  ["DOSSEG", "kwDosseg", "dosseg.md"],
  ["ECHO", "kwEcho", "echo.md"],
  ["ELSE", "kwElse", "else-masm.md"],
  ["ELSEIF", "kwElseif", "elseif-masm.md"],
  ["ELSEIF1", "kwElseif1", "if2.md"], // "ELSEIF1, and ELSEIF2"; also masm-bnf-grammar.md elseifStatement
  ["ELSEIF2", "kwElseif2", "elseif2.md"],
  ["ELSEIFB", "kwElseifb", "if-masm.md"], // list of ELSEIF substitutes; also masm-bnf-grammar.md
  ["ELSEIFDEF", "kwElseifdef", "if-masm.md"],
  ["ELSEIFDIF", "kwElseifdif", "if-masm.md"],
  ["ELSEIFDIFI", "kwElseifdifi", "if-masm.md"],
  ["ELSEIFE", "kwElseife", "if-masm.md"],
  ["ELSEIFIDN", "kwElseifidn", "if-masm.md"],
  ["ELSEIFIDNI", "kwElseifidni", "if-masm.md"],
  ["ELSEIFNB", "kwElseifnb", "if-masm.md"],
  ["ELSEIFNDEF", "kwElseifndef", "if-masm.md"],
  ["END", "kwEnd", "end-masm.md"],
  ["ENDIF", "kwEndif", "if-masm.md"],
  ["ENDM", "kwEndm", "endm.md"],
  ["ENDP", "kwEndp", "endp.md"],
  ["ENDS", "kwEnds", "ends-masm.md"],
  ["EQU", "kwEqu", "equ.md"],
  ["EVEN", "kwEven", "even.md"],
  ["EXITM", "kwExitm", "exitm.md"],
  ["EXTERN", "kwExtern", "extern-masm.md"],
  ["EXTERNDEF", "kwExterndef", "externdef.md"],
  ["EXTRN", "kwExtrn", "extrn.md"],
  ["FOR", "kwFor", "for-masm.md"],
  ["FORC", "kwForc", "forc.md"],
  ["GOTO", "kwGoto", "goto-masm.md"],
  ["GROUP", "kwGroup", "group.md"],
  ["IF", "kwIf", "if-masm.md"],
  ["IF1", "kwIf1", "if2.md"],
  ["IF2", "kwIf2", "if2.md"],
  ["IFB", "kwIfb", "ifb.md"],
  ["IFDEF", "kwIfdef", "ifdef.md"],
  ["IFDIF", "kwIfdif", "ifdif.md"],
  ["IFDIFI", "kwIfdifi", "ifdif.md"],
  ["IFE", "kwIfe", "ife.md"],
  ["IFIDN", "kwIfidn", "ifidn.md"],
  ["IFIDNI", "kwIfidni", "ifidn.md"],
  ["IFNB", "kwIfnb", "ifnb.md"],
  ["IFNDEF", "kwIfndef", "ifndef.md"],
  ["INCLUDE", "kwInclude", "include-masm.md"],
  ["INCLUDELIB", "kwIncludelib", "includelib-masm.md"],
  ["INSTR", "kwInstr", "instr.md"],
  ["INVOKE", "kwInvoke", "invoke.md"],
  ["IRP", "kwIrp", "irp.md"],
  ["IRPC", "kwIrpc", "irpc.md"],
  ["LABEL", "kwLabel", "label-masm.md"],
  ["LOCAL", "kwLocal", "local-masm.md"],
  ["MACRO", "kwMacro", "macro.md"],
  ["NAME", "kwName", "name-masm.md"],
  ["OPTION", "kwOption", "option-masm.md"],
  ["ORG", "kwOrg", "org.md"],
  ["PAGE", "kwPage", "page.md"], // also segment.md: PAGE alignment
  ["POPCONTEXT", "kwPopcontext", "popcontext.md"],
  ["PROC", "kwProc", "proc.md"], // also extern-masm.md (:PROC), option-masm.md (PROC:), label-masm.md (PROC PTR)
  ["PROTO", "kwProto", "proto.md"], // also typedef-masm.md
  ["PUBLIC", "kwPublic", "public-masm.md"], // also proc.md (visibility), segment.md (combine)
  ["PURGE", "kwPurge", "purge.md"],
  ["PUSHCONTEXT", "kwPushcontext", "pushcontext.md"],
  ["RECORD", "kwRecord", "record-masm.md"],
  ["REPEAT", "kwRepeat", "repeat.md"],
  ["REPT", "kwRept", "rept.md"],
  ["SEGMENT", "kwSegment", "segment.md"], // also option-masm.md (SEGMENT:), masm-bnf-grammar.md offsetType
  ["SIZESTR", "kwSizestr", "sizestr.md"],
  ["STRUC", "kwStruc", "struc.md"],
  ["STRUCT", "kwStruct", "struct-masm.md"],
  ["SUBSTR", "kwSubstr", "substr.md"],
  ["SUBTITLE", "kwSubtitle", "subtitle.md"],
  ["SUBTTL", "kwSubttl", "subttl.md"],
  ["TEXTEQU", "kwTextequ", "textequ.md"],
  ["TITLE", "kwTitle", "title.md"],
  ["TYPEDEF", "kwTypedef", "typedef-masm.md"],
  ["UNION", "kwUnion", "union.md"],
  ["WHILE", "kwWhile", "while-masm.md"],
];
// %OUT (percent-out.md) is a single token in masm.grammar (percentOut).

// ---------------------------------------------------------------------------
// Dotted directives. Matched on the whole DotWord token, e.g. ".CODE".
// ---------------------------------------------------------------------------
export const DOT_DIRECTIVES = [
  // processor / coprocessor (masm-bnf-grammar.md: processor, coprocessor)
  [".386", "dot386", "dot-386.md"],
  [".386P", "dot386p", "dot-386p.md"],
  [".387", "dot387", "dot-387.md"],
  [".486", "dot486", "dot-486.md"],
  [".486P", "dot486p", "dot-486p.md"],
  [".586", "dot586", "dot-586.md"],
  [".586P", "dot586p", "dot-586p.md"],
  [".686", "dot686", "dot-686.md"],
  [".686P", "dot686p", "dot-686p.md"],
  [".8087", "dot8087", "masm-bnf-grammar.md"], // coprocessor
  [".287", "dot287", "masm-bnf-grammar.md"], // coprocessor
  [".NO87", "dotNo87", "masm-bnf-grammar.md"], // coprocessor
  [".K3D", "dotK3d", "dot-k3d.md"],
  [".MMX", "dotMmx", "dot-mmx.md"],
  [".XMM", "dotXmm", "dot-xmm.md"],
  // x64 unwind, version 1 (masm-for-x64-ml64-exe.md lists them)
  [".ALLOCSTACK", "dotAllocstack", "dot-allocstack.md"],
  [".ENDPROLOG", "dotEndprolog", "dot-endprolog.md"],
  [".PUSHFRAME", "dotPushframe", "dot-pushframe.md"],
  [".PUSHREG", "dotPushreg", "dot-pushreg.md"],
  [".SAVEREG", "dotSavereg", "dot-savereg.md"],
  [".SAVEXMM128", "dotSavexmm128", "dot-savexmm128.md"],
  [".SETFRAME", "dotSetframe", "dot-setframe.md"],
  // x64 unwind, version 3 (experimental; vendored 2026-09-17, see syntax/README-SNAPSHOT.md)
  [".BEGINEPILOG", "dotBeginepilog", "dot-beginepilog.md"],
  [".ENDEPILOG", "dotEndepilog", "dot-endepilog.md"],
  [".FREESTACK", "dotFreestack", "dot-freestack.md"],
  [".POP2REG", "dotPop2reg", "dot-pop2reg.md"],
  [".POPFRAME", "dotPopframe", "dot-popframe.md"],
  [".POPREG", "dotPopreg", "dot-popreg.md"],
  [".PUSH2REG", "dotPush2reg", "dot-push2reg.md"],
  [".RESTOREREG", "dotRestorereg", "dot-restorereg.md"],
  [".RESTOREXMM128", "dotRestorexmm128", "dot-restorexmm128.md"],
  [".UNSETFRAME", "dotUnsetframe", "dot-unsetframe.md"],
  // segment ordering
  [".ALPHA", "dotAlpha", "dot-alpha.md"],
  [".SEQ", "dotSeq", "dot-seq.md"],
  [".DOSSEG", "dotDosseg", "dot-dosseg.md"],
  // simplified segments
  [".CODE", "dotCode", "dot-code.md"],
  [".CONST", "dotConst", "dot-const.md"],
  [".DATA", "dotData", "dot-data.md"],
  [".DATA?", "dotDataQ", "dot-data-q.md"],
  [".FARDATA", "dotFardata", "dot-fardata.md"],
  [".FARDATA?", "dotFardataQ", "dot-fardata-q.md"],
  [".STACK", "dotStack", "dot-stack.md"],
  [".MODEL", "dotModel", "dot-model.md"],
  [".STARTUP", "dotStartup", "dot-startup.md"],
  [".EXIT", "dotExit", "dot-exit.md"],
  // runtime control flow
  [".IF", "dotIf", "dot-if.md"],
  [".ELSEIF", "dotElseif", "dot-if.md"],
  [".ELSE", "dotElse", "dot-else.md"],
  [".ENDIF", "dotEndif", "dot-endif.md"],
  [".WHILE", "dotWhile", "dot-while.md"],
  [".ENDW", "dotEndw", "dot-endw.md"],
  [".REPEAT", "dotRepeat", "dot-repeat.md"],
  [".UNTIL", "dotUntil", "dot-until.md"],
  [".UNTILCXZ", "dotUntilcxz", "dot-untilcxz.md"],
  [".BREAK", "dotBreak", "dot-break.md"],
  [".CONTINUE", "dotContinue", "dot-continue.md"],
  // conditional error
  [".ERR", "dotErr", "dot-err.md"],
  [".ERR1", "dotErr1", "if2.md"], // ".ERR1, .ERR2"; also masm-bnf-grammar.md errorOpt
  [".ERR2", "dotErr2", "dot-err2.md"],
  [".ERRB", "dotErrb", "dot-errb.md"],
  [".ERRDEF", "dotErrdef", "dot-errdef.md"],
  [".ERRDIF", "dotErrdif", "dot-errdif.md"],
  [".ERRDIFI", "dotErrdifi", "dot-errdif.md"],
  [".ERRE", "dotErre", "dot-erre.md"],
  [".ERRIDN", "dotErridn", "dot-erridn.md"],
  [".ERRIDNI", "dotErridni", "dot-erridn.md"],
  [".ERRNB", "dotErrnb", "dot-errnb.md"],
  [".ERRNDEF", "dotErrndef", "dot-errndef.md"],
  [".ERRNZ", "dotErrnz", "dot-errnz.md"],
  // listing control
  [".CREF", "dotCref", "dot-cref.md"],
  [".XCREF", "dotXcref", "dot-xcref.md"],
  [".NOCREF", "dotNocref", "dot-nocref.md"],
  [".LIST", "dotList", "dot-list.md"],
  [".NOLIST", "dotNolist", "dot-nolist.md"],
  [".XLIST", "dotXlist", "dot-xlist.md"],
  [".LISTALL", "dotListall", "dot-listall.md"],
  [".LISTIF", "dotListif", "dot-listif.md"],
  [".NOLISTIF", "dotNolistif", "dot-nolistif.md"],
  [".LFCOND", "dotLfcond", "dot-lfcond.md"],
  [".SFCOND", "dotSfcond", "dot-sfcond.md"],
  [".TFCOND", "dotTfcond", "dot-tfcond.md"],
  [".LISTMACRO", "dotListmacro", "dot-listmacro.md"],
  [".NOLISTMACRO", "dotNolistmacro", "dot-nolistmacro.md"],
  [".LISTMACROALL", "dotListmacroall", "dot-listmacroall.md"],
  [".LALL", "dotLall", "dot-lall.md"],
  [".SALL", "dotSall", "dot-sall.md"],
  [".XALL", "dotXall", "dot-xall.md"],
  // miscellaneous
  [".RADIX", "dotRadix", "dot-radix.md"],
  [".FPO", "dotFpo", "dot-fpo.md"],
  [".SAFESEH", "dotSafeseh", "dot-safeseh.md"],
  // operator spelled with a dot (expression context, see masm.grammar)
  [".TYPE", "dotType", "operator-dot-type.md"],
];

// ---------------------------------------------------------------------------
// Data types (masm-bnf-grammar.md: dataType, dataDecl). One category term.
// ---------------------------------------------------------------------------
export const DATA_TYPES = [
  ["BYTE", "DataType", "byte-masm.md"],
  ["SBYTE", "DataType", "sbyte-masm.md"],
  ["WORD", "DataType", "word.md"],
  ["SWORD", "DataType", "sword.md"],
  ["DWORD", "DataType", "dword.md"],
  ["SDWORD", "DataType", "sdword.md"],
  ["FWORD", "DataType", "fword.md"],
  ["QWORD", "DataType", "qword.md"],
  ["SQWORD", "DataType", "sqword.md"],
  ["TBYTE", "DataType", "tbyte.md"],
  ["OWORD", "DataType", "oword.md"],
  ["REAL4", "DataType", "real4.md"],
  ["REAL8", "DataType", "real8.md"],
  ["REAL10", "DataType", "real10.md"],
  ["MMWORD", "DataType", "mmword.md"],
  ["XMMWORD", "DataType", "xmmword.md"],
  ["YMMWORD", "DataType", "ymmword.md"],
  ["DB", "DataType", "db.md"],
  ["DW", "DataType", "dw.md"],
  ["DD", "DataType", "dd.md"],
  ["DF", "DataType", "df.md"],
  ["DQ", "DataType", "dq.md"],
  ["DT", "DataType", "dt.md"],
];

// ---------------------------------------------------------------------------
// Operator keywords (operators-reference.md index; masm-bnf-grammar.md e01-e11).
// ---------------------------------------------------------------------------
export const OPERATOR_KEYWORDS = [
  ["AND", "opAnd", "operator-and.md"],
  ["OR", "opOr", "operator-or.md"],
  ["XOR", "opXor", "operator-xor.md"],
  ["NOT", "opNot", "operator-not.md"],
  ["SHL", "opShl", "operator-shl.md"],
  ["SHR", "opShr", "operator-shr.md"],
  ["MOD", "opMod", "operator-mod.md"],
  ["EQ", "opEq", "operator-eq.md"],
  ["NE", "opNe", "operator-ne.md"],
  ["LT", "opLt", "operator-lt.md"],
  ["LE", "opLe", "operator-le.md"],
  ["GT", "opGt", "operator-gt.md"],
  ["GE", "opGe", "operator-ge.md"],
  ["HIGH", "opHigh", "operator-high.md"],
  ["LOW", "opLow", "operator-low.md"],
  ["HIGHWORD", "opHighword", "operator-highword.md"],
  ["LOWWORD", "opLowword", "operator-lowword.md"],
  ["HIGH32", "opHigh32", "operator-high32.md"],
  ["LOW32", "opLow32", "operator-low32.md"],
  ["OFFSET", "opOffset", "operator-offset.md"], // also option-masm.md (OFFSET:)
  ["SEG", "opSeg", "operator-seg.md"], // also assume.md / masm-bnf-grammar.md frameExpr
  ["LROFFSET", "opLroffset", "operator-lroffset.md"],
  ["IMAGEREL", "opImagerel", "operator-imagerel.md"],
  ["SECTIONREL", "opSectionrel", "operator-sectionrel.md"],
  ["TYPE", "opType", "operator-type.md"],
  ["THIS", "opThis", "operator-this.md"],
  ["PTR", "opPtr", "operator-ptr.md"],
  ["SHORT", "opShort", "operator-short.md"],
  ["OPATTR", "opOpattr", "operator-opattr.md"],
  ["LENGTH", "opLength", "operator-length.md"],
  ["LENGTHOF", "opLengthof", "operator-lengthof.md"],
  ["SIZE", "opSize", "operator-size.md"],
  ["SIZEOF", "opSizeof", "operator-sizeof.md"],
  ["WIDTH", "opWidth", "operator-width.md"],
  ["MASK", "opMask", "operator-mask.md"],
  ["DUP", "opDup", "operator-dup.md"],
  ["ADDR", "opAddr", "operator-addr.md"],
  ["ABS", "opAbs", "operator-abs.md"],
  ["BCST", "opBcst", "instruction-format.md"], // AVX-512 embedded broadcast, "similar to the use of PTR"
];

// ---------------------------------------------------------------------------
// Attribute keywords that MASM reserves: specialized (they replace the
// identifier reading everywhere).
// ---------------------------------------------------------------------------
export const ATTRIBUTES = [
  // language types (option-language-masm.md; masm-bnf-grammar.md langType; dot-model.md)
  ["C", "atC", "option-language-masm.md"],
  ["PASCAL", "atPascal", "option-language-masm.md"],
  ["FORTRAN", "atFortran", "option-language-masm.md"],
  ["BASIC", "atBasic", "option-language-masm.md"],
  ["SYSCALL", "atSyscall", "option-language-masm.md"], // also an instruction mnemonic: see MNEMONIC_DUALS
  ["STDCALL", "atStdcall", "option-language-masm.md"],
  // distance (masm-bnf-grammar.md distance/nearfar; proc.md, proto.md, comm.md, label-masm.md)
  ["NEAR", "atNear", "masm-bnf-grammar.md"],
  ["FAR", "atFar", "masm-bnf-grammar.md"],
  ["NEAR16", "atNear16", "masm-bnf-grammar.md"],
  ["NEAR32", "atNear32", "masm-bnf-grammar.md"],
  ["FAR16", "atFar16", "masm-bnf-grammar.md"],
  ["FAR32", "atFar32", "masm-bnf-grammar.md"],
  // visibility (proc.md; masm-bnf-grammar.md oVisibility). PUBLIC is a directive keyword.
  ["PRIVATE", "atPrivate", "proc.md"], // also segment.md combine
  ["EXPORT", "atExport", "proc.md"],
  // memory models (dot-model.md; masm-bnf-grammar.md memOption)
  ["TINY", "atTiny", "dot-model.md"],
  ["SMALL", "atSmall", "dot-model.md"],
  ["MEDIUM", "atMedium", "dot-model.md"],
  ["COMPACT", "atCompact", "dot-model.md"],
  ["LARGE", "atLarge", "dot-model.md"],
  ["HUGE", "atHuge", "dot-model.md"],
  ["FLAT", "atFlat", "dot-model.md"], // also segment.md (use), option-masm.md (OFFSET:FLAT / SEGMENT:FLAT)
  ["NEARSTACK", "atNearstack", "dot-model.md"],
  ["FARSTACK", "atFarstack", "dot-model.md"],
  // segment attributes (segment.md; masm-bnf-grammar.md segAlign/segAttrib/segRO/segSize)
  ["PARA", "atPara", "segment.md"],
  ["STACK", "atStack", "segment.md"],
  ["COMMON", "atCommon", "segment.md"],
  ["MEMORY", "atMemory", "segment.md"],
  ["AT", "atAt", "segment.md"],
  ["READONLY", "atReadonly", "segment.md"], // also option-masm.md
  ["NOREADONLY", "atNoreadonly", "option-masm.md"],
  ["USE16", "atUse16", "segment.md"],
  ["USE32", "atUse32", "segment.md"],
  // PUSHCONTEXT / POPCONTEXT items (pushcontext.md, popcontext.md)
  ["ASSUMES", "atAssumes", "pushcontext.md"],
  ["LISTING", "atListing", "pushcontext.md"],
  ["CPU", "atCpu", "pushcontext.md"],
  ["RADIX", "atRadix", "pushcontext.md"],
  ["ALL", "atAll", "pushcontext.md"], // also masm-bnf-grammar.md mapType
  ["NONE", "atNone", "masm-bnf-grammar.md"], // mapType; also accepted as OPTION PROLOGUE:NONE / EPILOGUE:NONE
  // OPTION items (option-masm.md; option-avxencoding-masm.md; masm-bnf-grammar.md optionItem)
  ["CASEMAP", "atCasemap", "option-masm.md"],
  ["DOTNAME", "atDotname", "option-masm.md"],
  ["NODOTNAME", "atNodotname", "option-masm.md"],
  ["EMULATOR", "atEmulator", "option-masm.md"],
  ["NOEMULATOR", "atNoemulator", "option-masm.md"],
  ["EPILOGUE", "atEpilogue", "option-masm.md"],
  ["EXPR16", "atExpr16", "option-masm.md"],
  ["EXPR32", "atExpr32", "option-masm.md"],
  ["LANGUAGE", "atLanguage", "option-language-masm.md"],
  ["LJMP", "atLjmp", "option-masm.md"],
  ["NOLJMP", "atNoljmp", "option-masm.md"],
  ["M510", "atM510", "option-masm.md"],
  ["NOM510", "atNom510", "option-masm.md"],
  ["NOKEYWORD", "atNokeyword", "option-masm.md"],
  ["NOSIGNEXTEND", "atNosignextend", "option-masm.md"],
  ["OLDMACROS", "atOldmacros", "option-masm.md"],
  ["NOOLDMACROS", "atNooldmacros", "option-masm.md"],
  ["OLDSTRUCTS", "atOldstructs", "option-masm.md"],
  ["NOOLDSTRUCTS", "atNooldstructs", "option-masm.md"],
  ["PROLOGUE", "atPrologue", "option-masm.md"],
  ["SCOPED", "atScoped", "option-masm.md"],
  ["NOSCOPED", "atNoscoped", "option-masm.md"],
  ["SETIF2", "atSetif2", "option-masm.md"],
  ["AVXENCODING", "atAvxencoding", "option-avxencoding-masm.md"],
  // macro / proc parameter attributes
  ["REQ", "atReq", "macro.md"], // also for-masm.md, masm-bnf-grammar.md parmType
  ["VARARG", "atVararg", "macro.md"], // also proto.md, proc.md
  ["NONUNIQUE", "atNonunique", "struct-masm.md"], // also union.md
  ["USES", "atUses", "proc.md"],
  ["NOTHING", "atNothing", "assume.md"],
];

// ---------------------------------------------------------------------------
// Contextual attribute keywords: extended (both the keyword and the identifier
// reading are offered to the parser). These words are keywords only in one
// position and are legitimately used as identifiers elsewhere (e.g. windows.inc
// defines TRUE/FALSE as equates; `error` is a common label).
// ---------------------------------------------------------------------------
export const CONTEXTUAL_ATTRIBUTES = [
  ["TRUE", "xTrue", "masm-bnf-grammar.md"], // bool (OPTION SETIF2:)
  ["FALSE", "xFalse", "masm-bnf-grammar.md"],
  ["ERROR", "xError", "assume.md"], // "error" is a common label name
  ["CODE", "xCode", "dot-pushframe.md"], // also dot-popframe.md
  ["FRAME", "xFrame", "proc.md"],
  ["INFO", "xInfo", "segment.md"], // COFF characteristics
  ["READ", "xRead", "segment.md"],
  ["WRITE", "xWrite", "segment.md"],
  ["EXECUTE", "xExecute", "segment.md"],
  ["SHARED", "xShared", "segment.md"],
  ["NOPAGE", "xNopage", "segment.md"],
  ["NOCACHE", "xNocache", "segment.md"],
  ["DISCARD", "xDiscard", "segment.md"],
  ["NOTPUBLIC", "xNotpublic", "masm-bnf-grammar.md"], // mapType
  ["PREFER_FIRST", "xPreferFirst", "option-avxencoding-masm.md"],
  ["PREFER_VEX", "xPreferVex", "option-avxencoding-masm.md"],
  ["PREFER_VEX3", "xPreferVex3", "option-avxencoding-masm.md"],
  ["PREFER_EVEX", "xPreferEvex", "option-avxencoding-masm.md"],
  ["NO_EVEX", "xNoEvex", "option-avxencoding-masm.md"],
  // AVX-512 operand decorators, valid only inside { } after an operand
  ["Z", "xZ", "instruction-format.md"], // {z}
  ["SAE", "xSae", "instruction-format.md"], // {sae}, {rn-sae} ...
  ["RN", "xRn", "instruction-format.md"],
  ["RZ", "xRz", "instruction-format.md"],
  ["RD", "xRd", "instruction-format.md"],
  ["RU", "xRu", "instruction-format.md"],
];

// ---------------------------------------------------------------------------
// Instruction prefixes (instruction-format.md; masm-bnf-grammar.md instrPrefix).
// ML64 accepts REXW ("rexw jmp rax" assembles to 48 FF E0) and no other REX spelling (A2008).
// ---------------------------------------------------------------------------
export const PREFIXES = [
  ["REP", "Prefix", "instruction-format.md"],
  ["REPE", "Prefix", "instruction-format.md"],
  ["REPZ", "Prefix", "instruction-format.md"],
  ["REPNE", "Prefix", "instruction-format.md"],
  ["REPNZ", "Prefix", "instruction-format.md"],
  ["LOCK", "Prefix", "instruction-format.md"],
  ["XACQUIRE", "Prefix", "instruction-format.md"],
  ["XRELEASE", "Prefix", "instruction-format.md"],
  ["VEX", "Prefix", "instruction-format.md"],
  ["VEX2", "Prefix", "instruction-format.md"],
  ["VEX3", "Prefix", "instruction-format.md"],
  ["EVEX", "Prefix", "instruction-format.md"],
  [
    "REXW",
    "Prefix",
    "ISA: Intel SDM Vol. 2A, 2.2.1 REX Prefixes (REX.W); ML64 spells the prefix REXW",
  ],
];

// ---------------------------------------------------------------------------
// Registers. The BNF lists (masm-bnf-grammar.md: byteRegister, gpRegister,
// qwordRegister, segmentRegister, fpuRegister, simdRegister, xmmRegister,
// specialRegister) are transcribed verbatim; entries marked "ISA:" complete
// families the reference truncates or omits and cite the manual that
// syntax/processor-manufacturer-programming-manuals.md links to.
// ---------------------------------------------------------------------------
function regs(prefix, from, to, suffix, term, source) {
  const out = [];
  for (let i = from; i <= to; i++)
    out.push([`${prefix}${i}${suffix}`, term, source]);
  return out;
}
const BNF = "masm-bnf-grammar.md";
const SDM_GPR =
  "ISA: Intel SDM Vol. 1, 3.4.1.1 General-Purpose Registers in 64-Bit Mode";
const SDM_AVX512 =
  "ISA: Intel SDM Vol. 1, Ch. 15 (AVX-512 register state); examples in instruction-format.md use zmm/k registers";
const SDM_CR = "ISA: Intel SDM Vol. 3, 2.5 Control Registers";
const APX =
  "ISA: Intel APX Architecture Specification (R16-R31); dot-pop2reg.md / dot-popreg.md / dot-push2reg.md list R16-R31";
const SDM_MPX =
  "ISA: Intel SDM Vol. 1, 3.2 and Appendix E.3 (Intel MPX bounds registers BND0-BND3)";
const SDM_AMX =
  "ISA: Intel SDM Vol. 1, 19.1 (Intel AMX tile registers TMM0..TMM7)";

export const REGISTERS = [
  // byteRegister (BNF)
  ...["AL", "AH", "CL", "CH", "DL", "DH", "BL", "BH"].map((r) => [
    r,
    "Register",
    BNF,
  ]),
  ...regs("R", 8, 15, "B", "Register", BNF),
  ...["SPL", "BPL", "SIL", "DIL"].map((r) => [r, "Register", SDM_GPR]),
  // gpRegister (BNF) + the R8-R15 W/D forms the BNF list truncates
  ...[
    "AX",
    "EAX",
    "CX",
    "ECX",
    "DX",
    "EDX",
    "BX",
    "EBX",
    "DI",
    "EDI",
    "SI",
    "ESI",
    "BP",
    "EBP",
    "SP",
    "ESP",
  ].map((r) => [r, "Register", BNF]),
  ...["R8W", "R8D", "R9W", "R9D", "R12D", "R13W", "R13D", "R14W", "R14D"].map(
    (r) => [r, "Register", BNF],
  ),
  ...["R10W", "R10D", "R11W", "R11D", "R12W", "R15W", "R15D"].map((r) => [
    r,
    "Register",
    SDM_GPR + "; masm-for-x64-ml64-exe.md uses r10d/r8d",
  ]),
  // qwordRegister (BNF)
  ...["RAX", "RCX", "RDX", "RBX", "RSP", "RBP", "RSI", "RDI"].map((r) => [
    r,
    "Register",
    BNF,
  ]),
  ...regs("R", 8, 15, "", "Register", BNF),
  // APX extended general-purpose registers
  ...regs("R", 16, 31, "", "Register", APX),
  ...regs("R", 16, 31, "B", "Register", APX),
  ...regs("R", 16, 31, "W", "Register", APX),
  ...regs("R", 16, 31, "D", "Register", APX),
  // segmentRegister (BNF)
  ...["CS", "DS", "ES", "FS", "GS", "SS"].map((r) => [r, "Register", BNF]),
  // fpuRegister (BNF): ST and ST(expr) only - there is no ST0..ST7 in MASM
  ["ST", "StReg", BNF],
  // simdRegister / xmmRegister (BNF) + AVX-512 extensions
  ...regs("MM", 0, 7, "", "Register", BNF),
  ...regs("XMM", 0, 15, "", "Register", BNF),
  ...regs("XMM", 16, 31, "", "Register", SDM_AVX512),
  ...regs("YMM", 0, 15, "", "Register", BNF),
  ...regs("YMM", 16, 31, "", "Register", SDM_AVX512),
  ...regs("ZMM", 0, 31, "", "Register", SDM_AVX512),
  ...regs(
    "K",
    0,
    7,
    "",
    "Register",
    "instruction-format.md ({k1}..{k7}); " + SDM_AVX512,
  ),
  // MPX bounds and AMX tile registers: ML and ML64 assemble BND0-BND3, ML64 TMM0-TMM7
  ...regs("BND", 0, 3, "", "Register", SDM_MPX),
  ...regs("TMM", 0, 7, "", "Register", SDM_AMX),
  // specialRegister (BNF) + CR4/CR8
  ...["CR0", "CR2", "CR3"].map((r) => [r, "Register", BNF]),
  ...["CR4", "CR8"].map((r) => [r, "Register", SDM_CR]),
  ...["DR0", "DR1", "DR2", "DR3", "DR6", "DR7"].map((r) => [
    r,
    "Register",
    BNF,
  ]),
  ...regs("TR", 3, 7, "", "Register", BNF),
];

// ---------------------------------------------------------------------------
// Runtime flag tests (operators-reference.md, "Control Flow").
// ---------------------------------------------------------------------------
export const FLAG_NAMES = [
  ["ZERO?", "FlagName", "operator-zero-q.md"],
  ["CARRY?", "FlagName", "operator-carry-q.md"],
  ["OVERFLOW?", "FlagName", "operator-overflow-q.md"],
  ["SIGN?", "FlagName", "operator-sign-q.md"],
  ["PARITY?", "FlagName", "operator-parity-q.md"],
];

// ---------------------------------------------------------------------------
// Predefined symbols (symbols-reference.md index).
// ---------------------------------------------------------------------------
export const PREDEFINED_SYMBOLS = [
  ["@@", "AnonLabel", "at-at.md"], // only valid as "@@:"
  ["@B", "PredefinedSymbol", "at-b.md"],
  ["@F", "PredefinedSymbol", "at-f.md"],
  ["@CATSTR", "MacroFunction", "at-catstr.md"],
  ["@INSTR", "MacroFunction", "at-instr.md"],
  ["@SIZESTR", "MacroFunction", "at-sizestr.md"],
  ["@SUBSTR", "MacroFunction", "at-substr.md"],
  ["@ENVIRON", "MacroFunction", "at-environ.md"],
  ["@DATE", "PredefinedSymbol", "at-date.md"],
  ["@TIME", "PredefinedSymbol", "at-time.md"],
  ["@CPU", "PredefinedSymbol", "at-cpu.md"],
  ["@INTERFACE", "PredefinedSymbol", "at-interface.md"],
  ["@VERSION", "PredefinedSymbol", "at-version.md"],
  ["@FILECUR", "PredefinedSymbol", "at-filecur.md"],
  ["@FILENAME", "PredefinedSymbol", "at-filename.md"],
  ["@LINE", "PredefinedSymbol", "at-line.md"],
  ["@CODE", "PredefinedSymbol", "at-code.md"],
  ["@CODESIZE", "PredefinedSymbol", "at-codesize.md"],
  ["@CURSEG", "PredefinedSymbol", "at-curseg.md"],
  ["@DATA", "PredefinedSymbol", "at-data.md"],
  ["@DATASIZE", "PredefinedSymbol", "at-datasize.md"],
  ["@FARDATA", "PredefinedSymbol", "at-fardata.md"],
  ["@FARDATA?", "PredefinedSymbol", "at-fardata-q.md"],
  ["@MODEL", "PredefinedSymbol", "at-model.md"],
  ["@STACK", "PredefinedSymbol", "at-stack.md"],
  ["@WORDSIZE", "PredefinedSymbol", "at-wordsize.md"],
  ["@UNWINDVERSION", "PredefinedSymbol", "at-unwindversion.md"],
];

// One-character symbols that lex as identifiers (BNF alpha includes $ and ?).
export const SPECIAL_SYMBOLS = [
  ["$", "LocationCounter", "dollar.md"],
  ["?", "Uninitialized", "q.md"],
];

// Words that are BOTH an instruction mnemonic and a reference keyword. tokens.js
// returns Mnemonic when the parser can shift a mnemonic (statement start) and
// the keyword term otherwise (operator inside an expression, langType after
// PROC/PROTO/.MODEL). mnemonics.js must not contain these words.
export const MNEMONIC_DUALS = {
  AND: "opAnd",
  OR: "opOr",
  XOR: "opXor",
  NOT: "opNot",
  SHL: "opShl",
  SHR: "opShr",
  SYSCALL: "atSyscall",
};

export const SPECIALIZED_KEYWORDS = [
  ...DIRECTIVES,
  ...DATA_TYPES,
  ...OPERATOR_KEYWORDS,
  ...ATTRIBUTES,
  ...PREFIXES,
  ...REGISTERS,
  ...FLAG_NAMES,
  ...PREDEFINED_SYMBOLS,
  ...SPECIAL_SYMBOLS,
];

export const ALL_KEYWORD_LISTS = {
  DIRECTIVES,
  DOT_DIRECTIVES,
  DATA_TYPES,
  OPERATOR_KEYWORDS,
  ATTRIBUTES,
  CONTEXTUAL_ATTRIBUTES,
  PREFIXES,
  REGISTERS,
  FLAG_NAMES,
  PREDEFINED_SYMBOLS,
  SPECIAL_SYMBOLS,
};
