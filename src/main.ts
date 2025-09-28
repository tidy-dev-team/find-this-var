import { emit, once, showUI } from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  CreateRectanglesHandler,
  GetColorVariablesHandler,
  ColorVariable,
} from "./types";

export default function () {
  once<CreateRectanglesHandler>("CREATE_RECTANGLES", function (count: number) {
    const nodes: Array<SceneNode> = [];
    for (let i = 0; i < count; i++) {
      const rect = figma.createRectangle();
      rect.x = i * 150;
      rect.fills = [
        {
          color: { b: 0, g: 0.5, r: 1 },
          type: "SOLID",
        },
      ];
      figma.currentPage.appendChild(rect);
      nodes.push(rect);
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    figma.closePlugin();
  });

  once<GetColorVariablesHandler>("GET_COLOR_VARIABLES", function () {
    try {
      const localVariables = figma.variables.getLocalVariables();
      const colorVariables: ColorVariable[] = [];

      for (const variable of localVariables) {
        if (variable.resolvedType === "COLOR") {
          const colorVar: ColorVariable = {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            valuesByMode: {},
          };

          // Get values for each mode
          for (const modeId of Object.keys(variable.valuesByMode)) {
            const value = variable.valuesByMode[modeId];
            if (typeof value === "object" && "r" in value) {
              colorVar.valuesByMode[modeId] = value as RGBA;
            }
          }

          colorVariables.push(colorVar);
        }
      }

      emit("COLOR_VARIABLES_RESULT", colorVariables);
    } catch (error) {
      console.error("Error fetching color variables:", error);
      emit("COLOR_VARIABLES_RESULT", []);
    }
  });

  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });
  showUI({
    height: 400,
    width: 300,
  });
}
