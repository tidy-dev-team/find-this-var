import { emit, once, on, showUI } from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  CreateRectanglesHandler,
  GetColorVariablesHandler,
  FindBoundNodesHandler,
  GetCollectionsHandler,
  GetPagesHandler,
  CancelSearchHandler,
  ColorVariable,
  VariableCollection,
  Page,
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
  // PHASE 2: Search cancellation flag
  let searchCancelled = false;

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

  on<GetCollectionsHandler>("GET_COLLECTIONS", function () {
    try {
      const localCollections = figma.variables.getLocalVariableCollections();
      const collections: VariableCollection[] = localCollections.map(
        (collection) => ({
          id: collection.id,
          name: collection.name,
        })
      );
      emit("COLLECTIONS_RESULT", collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      emit("COLLECTIONS_RESULT", []);
    }
  });

  on<GetPagesHandler>("GET_PAGES", function () {
    try {
      const allPages = figma.root.children;
      const pages: Page[] = allPages.map((page) => ({
        id: page.id,
        name: page.name,
      }));
      // PHASE 1 OPTIMIZATION: Send current page ID for default selection
      emit("PAGES_RESULT", { pages, currentPageId: figma.currentPage.id });
    } catch (error) {
      console.error("Error fetching pages:", error);
      emit("PAGES_RESULT", { pages: [], currentPageId: null });
    }
  });

  const collectionCache = new Map<
    string,
    { defaultModeId: string; modes: { id: string; name: string }[] }
  >();

  on<GetColorVariablesHandler>(
    "GET_COLOR_VARIABLES",
    function (options: { collectionId: string | null }) {
      const { collectionId } = options;
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
            if (
              collectionId &&
              variable.variableCollectionId !== collectionId
            ) {
              continue;
            }

            // Get collection info for modes
            let collectionInfo = collectionCache.get(
              variable.variableCollectionId
            );
            if (!collectionInfo) {
              const collection = figma.variables.getVariableCollectionById(
                variable.variableCollectionId
              );
              if (collection) {
                collectionInfo = {
                  defaultModeId: collection.defaultModeId,
                  modes: collection.modes.map((mode) => ({
                    id: mode.modeId,
                    name: mode.name,
                  })),
                };
                collectionCache.set(
                  variable.variableCollectionId,
                  collectionInfo
                );
              }
            }

            const colorVar: ColorVariable = {
              id: variable.id,
              name: variable.name,
              resolvedType: variable.resolvedType,
              valuesByMode: {},
              defaultModeId:
                collectionInfo?.defaultModeId ||
                Object.keys(variable.valuesByMode)[0] ||
                "",
              modes: collectionInfo?.modes || [],
              description: variable.description || "",
              isLocal: true,
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
        }

        emit("COLOR_VARIABLES_RESULT", colorVariables);
      } catch (error) {
        console.error("Error fetching color variables:", error);
        emit("COLOR_VARIABLES_RESULT", []);
      }
    }
  );

  on<FindBoundNodesHandler>(
    "FIND_BOUND_NODES",
    async function (options: {
      variableIds: string[];
      pageId?: string | null;
    }) {
      try {
        const { variableIds, pageId } = options;
        searchCancelled = false; // Reset cancellation flag

        console.log(
          `🔍 Finding bound nodes for ${variableIds.length} selected variables${
            pageId
              ? ` on page ${figma.getNodeById(pageId)?.name || pageId}`
              : " on all pages"
          }...`
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
          if (searchCancelled) {
            console.log("🛑 Search cancelled by user");
            break;
          }

          try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
              // PHASE 2: Pass callbacks for progress and streaming (now async)
              const boundNodes = await findNodesWithBoundVariable(
                variable,
                true,
                pageId,
                {
                  onProgress: (current, total, nodesFound) => {
                    emit("SEARCH_PROGRESS", {
                      current,
                      total,
                      percentage: Math.round((current / total) * 100),
                      nodesFound,
                    });
                  },
                  onStreamingResult: (result) => {
                    emit("STREAMING_RESULT", result);
                  },
                  shouldCancel: () => searchCancelled,
                }
              );

              const summary = await getVariableUsageSummary(
                variable,
                true,
                pageId
              );

              results.push({
                variable,
                boundNodes,
                summary,
                instancesOnly: true,
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
            console.log(
              `🎨 Creating result table for ${results.length} variables...`
            );
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
                `${index + 1}. Variable: ${result.variable.name} - ${
                  result.boundNodes.length
                } nodes found`
              );
              result.boundNodes.forEach((boundNode, nodeIndex) => {
                console.log(
                  `   ${nodeIndex + 1}. ${boundNode.node.name} (${
                    boundNode.node.type
                  }) - ${boundNode.boundProperties.join(", ")}`
                );
              });
            });
          }
        } else {
          console.log(`⚠️ No results to display`);
        }
      } catch (error) {
        console.error("❌ Error finding bound nodes:", error);
      } finally {
        emit("FIND_BOUND_NODES_COMPLETE");
      }
    }
  );

  // PHASE 2: Handle search cancellation
  on<CancelSearchHandler>("CANCEL_SEARCH", function () {
    console.log("🛑 Cancellation requested by user");
    searchCancelled = true;
  });

  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });
  showUI({
    height: 800,
    width: 520,
  });
}
