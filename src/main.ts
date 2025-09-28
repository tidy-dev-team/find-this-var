import { emit, once, showUI } from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  CreateRectanglesHandler,
  GetColorVariablesHandler,
  FindBoundNodesHandler,
  ColorVariable,
} from "./types";
import {
  findNodesWithBoundVariable,
  getVariableUsageSummary,
} from "./findBoundVariables";

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

  once<FindBoundNodesHandler>(
    "FIND_BOUND_NODES",
    function (variableIds: string[]) {
      try {
        console.log(
          `🔍 Finding bound nodes for ${variableIds.length} selected variables...`
        );

        const results = [];

        for (const variableId of variableIds) {
          try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
              const boundNodes = findNodesWithBoundVariable(variable);
              const summary = getVariableUsageSummary(variable);

              console.log(
                `\n📌 Variable: "${variable.name}" (${variable.resolvedType})`
              );
              console.log(`   Used in ${boundNodes.length} nodes`);

              if (boundNodes.length > 0) {
                // Group nodes by page for better organization
                const nodesByPage = boundNodes.reduce((acc, nodeInfo) => {
                  if (!acc[nodeInfo.pageName]) {
                    acc[nodeInfo.pageName] = [];
                  }
                  acc[nodeInfo.pageName].push(nodeInfo);
                  return acc;
                }, {} as Record<string, typeof boundNodes>);

                console.log(
                  `   Node types: ${Object.entries(summary.nodesByType)
                    .map(([type, count]) => `${type}(${count})`)
                    .join(", ")}`
                );
                console.log(
                  `   Properties: ${Object.entries(summary.propertyUsage)
                    .map(([prop, count]) => `${prop}(${count})`)
                    .join(", ")}`
                );
                console.log(`   Pages: ${Object.keys(nodesByPage).join(", ")}`);

                boundNodes.forEach(
                  (
                    { node, boundProperties, propertyPath, pageName },
                    index
                  ) => {
                    console.log(
                      `   ${index + 1}. ${node.name || node.type} (${
                        node.type
                      }) [Page: ${pageName}]`
                    );
                    console.log(
                      `      Properties: ${boundProperties.join(", ")}`
                    );
                    console.log(`      Path: ${propertyPath}`);
                  }
                );

                results.push({
                  variable: variable.name,
                  boundNodes: boundNodes.length,
                  summary,
                });
              } else {
                console.log(`   ⚠️  No nodes found using this variable`);
              }
            } else {
              console.log(`❌ Variable with ID ${variableId} not found`);
            }
          } catch (error) {
            console.error(`❌ Error processing variable ${variableId}:`, error);
          }
        }

        console.log(
          `\n📊 Summary: Found ${results.reduce(
            (total, r) => total + r.boundNodes,
            0
          )} total bound nodes across ${results.length} variables`
        );
      } catch (error) {
        console.error("❌ Error finding bound nodes:", error);
      }
    }
  );

  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });
  showUI({
    height: 800,
    width: 300,
  });
}
