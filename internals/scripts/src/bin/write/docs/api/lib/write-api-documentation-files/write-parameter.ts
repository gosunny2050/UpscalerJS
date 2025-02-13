import { Comment, DeclarationReflection, ParameterReflection, TypeParameterReflection } from "typedoc";
import { DecRef, Definitions, PlatformSpecificFileDeclarationReflection, isDeclarationReflection, isPlatformSpecificFileDeclarationReflection } from "../types.js";
import { getReferenceTypeOfParameter } from "./get-reference-type-of-parameter.js";
import { getURLFromSources } from "./get-url-from-sources.js";
import { sortChildrenByLineNumber } from "../sort-children-by-line-number.js";
import { getMatchingType } from "./get-matching-type.js";
import { TYPES_TO_EXPAND } from "../constants.js";

export const getSummary = (comment?: Comment) => comment?.summary.map(({ text }) => text).join('');

type MatchingType = undefined | DecRef | TypeParameterReflection;
type Parameter = ParameterReflection | DeclarationReflection;

const writeParameter = (
  methodName: string,
  parameter: Parameter,
  matchingType: MatchingType,
  definitions: Definitions,
  childParameters: string
) => {
  const comment = getSummary(parameter.comment);
  const { type, name, includeURL = true } = getReferenceTypeOfParameter(parameter.type, definitions);
  const parsedName = `${name}${type === 'array' ? '[]' : ''}`;

  let url: string | undefined;
  const typesToExpand = TYPES_TO_EXPAND[methodName === 'constructor' ? '_constructor' : methodName] || [];
  if (typesToExpand.includes(name)) {
    url = `#${name.toLowerCase()}`;
  } else if (includeURL) {
    url = getURLFromSources(matchingType);
  }
  const linkedName = url ? `[\`${parsedName}\`](${url})` : `\`${parsedName}\``;
  return [
    '-',
    `**${parameter.name}${parameter.flags?.isOptional ? '?' : ''}**:`,
    childParameters === '' ? linkedName : undefined, // only show the type information if we're not expanding it
    comment ? ` - ${comment.split('\n').join(" ")}` : undefined,
  ].filter(Boolean).join(' ');
};

const writePlatformSpecificParameter = (platform: string, parameter: DeclarationReflection, definitions: Definitions) => {
  const comment = getSummary(parameter.comment);
  const { type, name } = getReferenceTypeOfParameter(parameter.type, definitions);
  const url = getURLFromSources(parameter);
  const parsedName = `${name}${type === 'array' ? '[]' : ''}`;
  return [
    '-',
    `**[${platform}](${url})**:`,
    `\`${parsedName}\``,
    comment ? ` - ${comment}` : undefined,
  ].filter(Boolean).join(' ');
};


export const writePlatformSpecificDefinitions = (definitions: Definitions): string => {
  const platformSpecificTypes: PlatformSpecificFileDeclarationReflection[] = [];
  for (const type of Object.values(definitions.types)) {
    if (!isDeclarationReflection(type)) {
      platformSpecificTypes.push(type);
    }
  }
  return platformSpecificTypes.map(parameter => [
    writePlatformSpecificParameter('Browser', parameter.browser, definitions),
    writePlatformSpecificParameter('Node', parameter.node, definitions),
  ].join('\n')).join('\n');
};

export const getParameters = (
  methodName: string,
  parameters: Parameter[],
  definitions: Definitions,
  typeParameters: Record<string, TypeParameterReflection> = {},
  depth = 0
): string => {
  if (depth > 5) {
    throw new Error('Too many levels of depth');
  }
  return parameters.map((parameter) => {
    const matchingType = getMatchingType(parameter, definitions, typeParameters);
    if (matchingType) {
      const { children } = isPlatformSpecificFileDeclarationReflection(matchingType) ? matchingType.declarationReflection : matchingType;
      const childParameters = children ? getParameters(methodName, sortChildrenByLineNumber(children), definitions, typeParameters, depth + 1) : '';
      return [
        writeParameter(methodName, parameter, matchingType, definitions, childParameters),
        childParameters,
      ].filter(Boolean).map(line => Array(depth * 2).fill(' ').join('') + line).join('\n');
    }
    return undefined;
  }).filter(Boolean).join('\n');
};
