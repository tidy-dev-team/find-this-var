import { EventHandler } from "@create-figma-plugin/utilities";

export interface CreateRectanglesHandler extends EventHandler {
  name: "CREATE_RECTANGLES";
  handler: (count: number) => void;
}

export interface GetColorVariablesHandler extends EventHandler {
  name: "GET_COLOR_VARIABLES";
  handler: () => void;
}

export interface ColorVariablesResultHandler extends EventHandler {
  name: "COLOR_VARIABLES_RESULT";
  handler: (colorVariables: ColorVariable[]) => void;
}

export interface FindBoundNodesHandler extends EventHandler {
  name: "FIND_BOUND_NODES";
  handler: (variableIds: string[]) => void;
}

export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}

export interface ColorVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: { [key: string]: RGBA | string };
  isLocal: boolean;
  libraryName?: string;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}
