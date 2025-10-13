import { EventHandler } from "@create-figma-plugin/utilities";

export interface CreateRectanglesHandler extends EventHandler {
  name: "CREATE_RECTANGLES";
  handler: (count: number) => void;
}

export interface GetColorVariablesHandler extends EventHandler {
  name: "GET_COLOR_VARIABLES";
  handler: (options: { collectionId: string | null }) => void;
}

export interface GetCollectionsHandler extends EventHandler {
  name: "GET_COLLECTIONS";
  handler: () => void;
}

export interface CollectionsResultHandler extends EventHandler {
  name: "COLLECTIONS_RESULT";
  handler: (collections: VariableCollection[]) => void;
}

export interface ColorVariablesResultHandler extends EventHandler {
  name: "COLOR_VARIABLES_RESULT";
  handler: (colorVariables: ColorVariable[]) => void;
}

export interface FindBoundNodesHandler extends EventHandler {
  name: "FIND_BOUND_NODES";
  handler: (options: { variableIds: string[]; pageId?: string | null }) => void;
}

export interface FindBoundNodesCompleteHandler extends EventHandler {
  name: "FIND_BOUND_NODES_COMPLETE";
  handler: () => void;
}

export interface SearchProgressHandler extends EventHandler {
  name: "SEARCH_PROGRESS";
  handler: (progress: {
    current: number;
    total: number;
    percentage: number;
    nodesFound: number;
  }) => void;
}

export interface StreamingResultHandler extends EventHandler {
  name: "STREAMING_RESULT";
  handler: (result: {
    variableId: string;
    variableName: string;
    instanceNode: {
      id: string;
      name: string;
      type: string;
      pageName: string;
    };
  }) => void;
}

export interface CancelSearchHandler extends EventHandler {
  name: "CANCEL_SEARCH";
  handler: () => void;
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
  defaultModeId: string;
  modes: { id: string; name: string }[];
  description: string;
  isLocal: boolean;
  libraryName?: string;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface VariableCollection {
  id: string;
  name: string;
}

export interface Page {
  id: string;
  name: string;
}

export interface GetPagesHandler extends EventHandler {
  name: "GET_PAGES";
  handler: () => void;
}

export interface PagesResultHandler extends EventHandler {
  name: "PAGES_RESULT";
  handler: (result: { pages: Page[]; currentPageId: string | null }) => void;
}
