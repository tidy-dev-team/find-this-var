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
import {
  createResultTable,
  loadInterFont,
  resetFonts,
} from "./drawResultTable";

export default function () {
  // No custom navigation needed - using Figma's native hyperlinks only

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

        // Process variables from local collections (some might be external)
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

        // Additional scan: Look through all nodes to find external variable references
        // This helps discover published variables that aren't in local collections
        const discoveredVariableIds = new Set<string>();

        const scanNodeForVariableReferences = (node: SceneNode): void => {
          // Check fills for variable references
          if ("fills" in node && node.fills && Array.isArray(node.fills)) {
            node.fills.forEach((fill) => {
              if (fill.type === "SOLID" && fill.boundVariables?.color) {
                discoveredVariableIds.add(fill.boundVariables.color.id);
              }
            });
          }

          // Check strokes for variable references
          if (
            "strokes" in node &&
            node.strokes &&
            Array.isArray(node.strokes)
          ) {
            node.strokes.forEach((stroke) => {
              if (stroke.type === "SOLID" && stroke.boundVariables?.color) {
                discoveredVariableIds.add(stroke.boundVariables.color.id);
              }
            });
          }

          // Check boundVariables for other properties
          if ("boundVariables" in node && node.boundVariables) {
            Object.values(node.boundVariables).forEach((variableAlias) => {
              if (
                variableAlias &&
                typeof variableAlias === "object" &&
                "id" in variableAlias &&
                typeof variableAlias.id === "string"
              ) {
                discoveredVariableIds.add(variableAlias.id);
              }
            });
          }

          // Check effects for variable references
          if (
            "effects" in node &&
            node.effects &&
            Array.isArray(node.effects)
          ) {
            node.effects.forEach((effect) => {
              if (effect.boundVariables?.color?.id) {
                discoveredVariableIds.add(effect.boundVariables.color.id);
              }
              if (effect.boundVariables?.radius?.id) {
                discoveredVariableIds.add(effect.boundVariables.radius.id);
              }
              if (effect.boundVariables?.offset?.x?.id) {
                discoveredVariableIds.add(effect.boundVariables.offset.x.id);
              }
              if (effect.boundVariables?.offset?.y?.id) {
                discoveredVariableIds.add(effect.boundVariables.offset.y.id);
              }
              if (effect.boundVariables?.spread?.id) {
                discoveredVariableIds.add(effect.boundVariables.spread.id);
              }
            });
          }

          // Recursively check children
          if ("children" in node && node.children) {
            node.children.forEach((child) =>
              scanNodeForVariableReferences(child)
            );
          }
        };

        // Scan all pages for variable references
        figma.root.children.forEach((page) => {
          if (page.type === "PAGE") {
            page.children.forEach((child) =>
              scanNodeForVariableReferences(child)
            );
          }
        });

        console.log(
          `🔍 Discovered ${discoveredVariableIds.size} variable references in document`
        );

        // Process discovered variable IDs that weren't found in collections
        Array.from(discoveredVariableIds).forEach((variableId) => {
          if (!processedVariableIds.has(variableId)) {
            try {
              const variable = figma.variables.getVariableById(variableId);
              if (variable && variable.resolvedType === "COLOR") {
                const isLocalVar = localVariables.some(
                  (v) => v.id === variable.id
                );

                console.log(
                  `📥 Found external color variable: "${variable.name}" (${
                    isLocalVar ? "local" : "external"
                  })`
                );

                const colorVar: ColorVariable = {
                  id: variable.id,
                  name: variable.name,
                  resolvedType: variable.resolvedType,
                  valuesByMode: {},
                  isLocal: isLocalVar,
                  libraryName: !isLocalVar ? "External Library" : undefined,
                };

                // Get values for each mode
                for (const modeId of Object.keys(variable.valuesByMode)) {
                  const value = variable.valuesByMode[modeId];
                  colorVar.valuesByMode[modeId] = resolveVariableValue(
                    value,
                    modeId
                  );
                }

                colorVariables.push(colorVar);
                processedVariableIds.add(variable.id);
              }
            } catch (error) {
              console.warn(`Could not access variable ${variableId}:`, error);
            }
          }
        });
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
    async function (options: {
      variableIds: string[];
      componentsOnly: boolean;
    }) {
      try {
        const { variableIds, componentsOnly } = options;

        console.log(
          `🔍 Finding bound nodes for ${variableIds.length} selected variables...`
        );

        // Load fonts with better error handling
        try {
          await loadInterFont();
        } catch (fontError) {
          console.warn(
            "Font loading failed, continuing with defaults:",
            fontError
          );
        }

        const results = [];

        for (const variableId of variableIds) {
          try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
              const boundNodes = findNodesWithBoundVariable(
                variable,
                componentsOnly
              );
              const summary = getVariableUsageSummary(variable, componentsOnly);

              results.push({
                variable,
                boundNodes,
                summary,
                componentsOnly,
              });
            } else {
              console.log(`❌ Variable with ID ${variableId} not found`);
            }
          } catch (error) {
            console.error(`❌ Error processing variable ${variableId}:`, error);
          }
        }

        // Create visual table if we have results
        if (results.length > 0) {
          try {
            console.log(`🎨 Creating result table for ${results.length} variables...`);
            const resultTable = createResultTable(results);
            console.log(
              `📊 Successfully created visual result table with ${results.reduce(
                (total, r) => total + r.boundNodes.length,
                0
              )} total bound nodes across ${results.length} variables`
            );
          } catch (tableError) {
            console.error("❌ Error creating result table:", tableError);
            if (tableError instanceof Error) {
              console.error("Stack trace:", tableError.stack);
            }
            
            // Fallback to console output
            console.log("📋 Falling back to console output:");
            results.forEach((result, index) => {
              console.log(
                `${index + 1}. Variable: ${result.variable.name} - ${result.boundNodes.length} nodes found`
              );
              result.boundNodes.forEach((boundNode, nodeIndex) => {
                console.log(`   ${nodeIndex + 1}. ${boundNode.node.name} (${boundNode.node.type}) - ${boundNode.boundProperties.join(', ')}`);
              });
            });
          }
        } else {
          console.log(`⚠️ No results to display`);
        }
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
