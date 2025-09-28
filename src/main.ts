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
      // Get all variables including from remote collections
      const localVariableCollections =
        figma.variables.getLocalVariableCollections();
      const colorVariables: ColorVariable[] = [];
      const processedVariableIds = new Set<string>();

      // Helper function to resolve variable alias
      const resolveVariableValue = (
        value: any,
        modeId: string
      ): RGBA | string => {
        if (typeof value === "object" && value !== null && "r" in value) {
          return value as RGBA;
        } else if (
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          value.type === "VARIABLE_ALIAS"
        ) {
          try {
            const referencedVariable = figma.variables.getVariableById(
              value.id
            );
            if (
              referencedVariable &&
              referencedVariable.resolvedType === "COLOR"
            ) {
              const referencedValue = referencedVariable.valuesByMode[modeId];
              if (
                typeof referencedValue === "object" &&
                referencedValue !== null &&
                "r" in referencedValue
              ) {
                return referencedValue as RGBA;
              } else {
                return `→ ${referencedVariable.name}`;
              }
            }
          } catch (error) {
            console.error("Error resolving variable alias:", error);
          }
        }
        return "Unresolved";
      };

      // Process local variables
      const localVariables = figma.variables.getLocalVariables();
      for (const variable of localVariables) {
        if (
          variable.resolvedType === "COLOR" &&
          !processedVariableIds.has(variable.id)
        ) {
          const colorVar: ColorVariable = {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            valuesByMode: {},
            isLocal: true,
          };

          // Get values for each mode
          for (const modeId of Object.keys(variable.valuesByMode)) {
            const value = variable.valuesByMode[modeId];
            colorVar.valuesByMode[modeId] = resolveVariableValue(value, modeId);
          }

          colorVariables.push(colorVar);
          processedVariableIds.add(variable.id);
        }
      }

      // Try to find variables from external collections by checking all variables in the document
      // This is a workaround since getRemoteVariables() doesn't exist
      try {
        const allCollections = figma.variables.getLocalVariableCollections();

        // Also try to get variables that might be references from external sources
        // by examining existing variable collections and their variables
        for (const collection of allCollections) {
          for (const variableId of collection.variableIds) {
            try {
              const variable = figma.variables.getVariableById(variableId);
              if (
                variable &&
                variable.resolvedType === "COLOR" &&
                !processedVariableIds.has(variable.id)
              ) {
                const isLocalVar = localVariables.some(
                  (v) => v.id === variable.id
                );

                const colorVar: ColorVariable = {
                  id: variable.id,
                  name: variable.name,
                  resolvedType: variable.resolvedType,
                  valuesByMode: {},
                  isLocal: isLocalVar,
                  libraryName: !isLocalVar ? collection.name : undefined,
                };

                // Get values for each mode
                for (const modeId of Object.keys(variable.valuesByMode)) {
                  const value = variable.valuesByMode[modeId];
                  colorVar.valuesByMode[modeId] = resolveVariableValue(
                    value,
                    modeId
                  );
                }

                if (!processedVariableIds.has(variable.id)) {
                  colorVariables.push(colorVar);
                  processedVariableIds.add(variable.id);
                }
              }
            } catch (error) {
              // Skip variables that can't be accessed
              continue;
            }
          }
        }
      } catch (error) {
        console.warn("Could not access some variable collections:", error);
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
    height: 800,
    width: 300,
  });
}
