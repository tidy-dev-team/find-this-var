/**
 * Finds all nodes in the document where a specific variable is bound/used
 */

export interface BoundNodeInfo {
  node: SceneNode;
  boundProperties: string[];
  propertyPath: string;
  pageName: string;
}

/**
 * Recursively traverses all nodes in the document to find where a variable is used
 * @param variable - The variable to search for
 * @param instancesOnly - If true, only search within INSTANCE nodes
 * @returns Array of nodes and properties where the variable is bound
 */
export function findNodesWithBoundVariable(
  variable: Variable,
  instancesOnly: boolean = false,
  pageId?: string | null
): BoundNodeInfo[] {
  const boundNodes: BoundNodeInfo[] = [];
  const variableId = variable.id;
  const variableKey = variable.key;

  // PHASE 1 OPTIMIZATION: Pre-build Set of target variable IDs for fast lookups
  const targetVariableIds = new Set<string>([variableId]);

  // Cache for variable IDs to keys - prevents repeated API calls
  const variableKeyCache = new Map<string, string>();
  variableKeyCache.set(variableId, variableKey);

  // PHASE 1 OPTIMIZATION: Cache variable objects to avoid repeated getVariableById calls
  const variableCache = new Map<string, Variable>();
  variableCache.set(variableId, variable);

  // Track instances we've already added to avoid adding nested instances
  const processedInstances = new Set<string>();

  /**
   * Helper function to check if a variable alias matches our target variable
   * PHASE 1 OPTIMIZED: Fast Set lookup, then cache-based key comparison
   */
  function isMatchingVariable(boundVar: VariableAlias): boolean {
    // Fast path: Check Set first (O(1) instead of string comparison)
    if (targetVariableIds.has(boundVar.id)) {
      return true;
    }

    // Check cache first
    let cachedKey = variableKeyCache.get(boundVar.id);

    if (cachedKey === undefined) {
      // Not in cache, fetch once and cache it
      try {
        // Check variable cache first to avoid API call
        let referencedVar = variableCache.get(boundVar.id);
        if (!referencedVar) {
          const fetchedVar = figma.variables.getVariableById(boundVar.id);
          if (fetchedVar) {
            referencedVar = fetchedVar;
            variableCache.set(boundVar.id, fetchedVar);
          }
        }

        if (referencedVar) {
          cachedKey = referencedVar.key;
          variableKeyCache.set(boundVar.id, cachedKey);

          // If keys match, add to targetVariableIds for even faster future lookups
          if (cachedKey === variableKey) {
            targetVariableIds.add(boundVar.id);
          }
        } else {
          // Cache null result to avoid repeated lookups
          variableKeyCache.set(boundVar.id, "");
          return false;
        }
      } catch (error) {
        // Cache failed lookup
        variableKeyCache.set(boundVar.id, "");
        return false;
      }
    }

    // Compare keys
    return cachedKey === variableKey;
  }

  /**
   * Find the top-level instance that contains this node
   */
  function findTopLevelInstance(node: SceneNode): InstanceNode | null {
    let topInstance: InstanceNode | null = null;
    let currentNode: BaseNode | null = node;

    while (currentNode && currentNode.parent) {
      if (currentNode.type === "INSTANCE") {
        topInstance = currentNode as InstanceNode;
      }
      if (currentNode.parent.type === "PAGE") {
        break;
      }
      currentNode = currentNode.parent;
    }

    return topInstance;
  }

  /**
   * Recursively check a node and its children for variable bindings
   */
  function checkNode(node: SceneNode): void {
    const boundProperties: string[] = [];

    try {
      // PHASE 1 OPTIMIZATION: Skip invisible and locked nodes for performance
      if ("visible" in node && node.visible === false) {
        return; // Skip invisible nodes and their children
      }
      if ("locked" in node && node.locked === true) {
        return; // Skip locked nodes and their children
      }

      // Check all nodes normally since filtering is done at the root level

      // Check fills for variable bindings
      if ("fills" in node && node.fills && Array.isArray(node.fills)) {
        node.fills.forEach((fill, index) => {
          if (fill.type === "SOLID" && fill.boundVariables?.color) {
            if (isMatchingVariable(fill.boundVariables.color)) {
              boundProperties.push(`fills[${index}].color`);
            }
          }
        });
      }

      // Check strokes for variable bindings
      if ("strokes" in node && node.strokes && Array.isArray(node.strokes)) {
        node.strokes.forEach((stroke, index) => {
          if (stroke.type === "SOLID" && stroke.boundVariables?.color) {
            if (isMatchingVariable(stroke.boundVariables.color)) {
              boundProperties.push(`strokes[${index}].color`);
            }
          }
        });
      }

      // Check basic boundVariables properties that are common across all node types
      if ("boundVariables" in node && node.boundVariables) {
        // Width and height (available on most nodes)
        if (
          node.boundVariables.width &&
          isMatchingVariable(node.boundVariables.width)
        ) {
          boundProperties.push("width");
        }
        if (
          node.boundVariables.height &&
          isMatchingVariable(node.boundVariables.height)
        ) {
          boundProperties.push("height");
        }

        // Layout properties (auto-layout nodes)
        if (
          node.boundVariables.paddingLeft &&
          isMatchingVariable(node.boundVariables.paddingLeft)
        ) {
          boundProperties.push("paddingLeft");
        }
        if (
          node.boundVariables.paddingRight &&
          isMatchingVariable(node.boundVariables.paddingRight)
        ) {
          boundProperties.push("paddingRight");
        }
        if (
          node.boundVariables.paddingTop &&
          isMatchingVariable(node.boundVariables.paddingTop)
        ) {
          boundProperties.push("paddingTop");
        }
        if (
          node.boundVariables.paddingBottom &&
          isMatchingVariable(node.boundVariables.paddingBottom)
        ) {
          boundProperties.push("paddingBottom");
        }
        if (
          node.boundVariables.itemSpacing &&
          isMatchingVariable(node.boundVariables.itemSpacing)
        ) {
          boundProperties.push("itemSpacing");
        }
        if (
          node.boundVariables.counterAxisSpacing &&
          isMatchingVariable(node.boundVariables.counterAxisSpacing)
        ) {
          boundProperties.push("counterAxisSpacing");
        }

        // Text properties (text nodes only)
        if (node.type === "TEXT") {
          if (
            node.boundVariables.characters &&
            isMatchingVariable(node.boundVariables.characters)
          ) {
            boundProperties.push("characters");
          }
        }
      }

      // Use Figma's built-in method to get all bound variables for this node
      // Note: This approach manually checks common bound variable properties
      // since getBoundVariablesForNode() may not be available in all API versions

      // Check effect properties (shadows, blurs)
      if ("effects" in node && node.effects && Array.isArray(node.effects)) {
        node.effects.forEach((effect, index) => {
          if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
            if (
              effect.boundVariables?.color &&
              isMatchingVariable(effect.boundVariables.color)
            ) {
              boundProperties.push(`effects[${index}].color`);
            }
            if (
              effect.boundVariables?.offset?.x &&
              isMatchingVariable(effect.boundVariables.offset.x)
            ) {
              boundProperties.push(`effects[${index}].offset.x`);
            }
            if (
              effect.boundVariables?.offset?.y &&
              isMatchingVariable(effect.boundVariables.offset.y)
            ) {
              boundProperties.push(`effects[${index}].offset.y`);
            }
            if (
              effect.boundVariables?.radius &&
              isMatchingVariable(effect.boundVariables.radius)
            ) {
              boundProperties.push(`effects[${index}].radius`);
            }
            if (
              effect.boundVariables?.spread &&
              isMatchingVariable(effect.boundVariables.spread)
            ) {
              boundProperties.push(`effects[${index}].spread`);
            }
          }
          if (
            effect.type === "LAYER_BLUR" ||
            effect.type === "BACKGROUND_BLUR"
          ) {
            if (
              effect.boundVariables?.radius &&
              isMatchingVariable(effect.boundVariables.radius)
            ) {
              boundProperties.push(`effects[${index}].radius`);
            }
          }
        });
      }

      // Check component properties (for instances)
      if (node.type === "INSTANCE" && "componentProperties" in node) {
        try {
          const componentProperties = node.componentProperties;
          if (componentProperties) {
            Object.entries(componentProperties).forEach(
              ([propName, propValue]) => {
                if (
                  propValue &&
                  typeof propValue === "object" &&
                  "boundVariables" in propValue &&
                  propValue.boundVariables?.value &&
                  isMatchingVariable(propValue.boundVariables.value)
                ) {
                  boundProperties.push(`componentProperties.${propName}`);
                }
              }
            );
          }
        } catch (error) {
          // Skip instances with component errors
          console.warn(
            `Skipping node ${node.id} due to component property error:`,
            error
          );
        }
      }

      // If any properties are bound to this variable, add the node to results
      if (boundProperties.length > 0) {
        if (instancesOnly) {
          // Find the top-level instance containing this node
          // This works whether the node itself is an instance or a child inside an instance
          const topInstance = findTopLevelInstance(node);

          if (topInstance && !processedInstances.has(topInstance.id)) {
            processedInstances.add(topInstance.id);
            boundNodes.push({
              node: topInstance,
              boundProperties,
              propertyPath: getNodePath(topInstance),
              pageName: getNodePage(topInstance),
            });
          }
        } else {
          // Normal mode - add the node itself
          boundNodes.push({
            node,
            boundProperties,
            propertyPath: getNodePath(node),
            pageName: getNodePage(node),
          });
        }
      }

      // Recursively check children
      if ("children" in node && node.children) {
        node.children.forEach((child) => checkNode(child));
      }
    } catch (error) {
      // Skip nodes that throw errors during property access
      console.warn(
        `Skipping node ${node.id} (${node.name}) due to error:`,
        error
      );
    }
  }

  /**
   * Get the page name where a node is located
   */
  function getNodePage(node: SceneNode): string {
    let currentNode: BaseNode | null = node;

    while (currentNode && currentNode.parent) {
      if (currentNode.parent.type === "PAGE") {
        return currentNode.parent.name || "Unnamed Page";
      }
      currentNode = currentNode.parent;
    }

    return "Unknown Page";
  }

  /**
   * Get the page ID where a node is located
   */
  function getNodePageId(node: SceneNode): string | null {
    let currentNode: BaseNode | null = node;

    while (currentNode && currentNode.parent) {
      if (currentNode.parent.type === "PAGE") {
        return currentNode.parent.id;
      }
      currentNode = currentNode.parent;
    }

    return null;
  }

  /**
   * Get the path to a node (for debugging/display purposes)
   */
  function getNodePath(node: SceneNode): string {
    const path: string[] = [];
    let currentNode: BaseNode | null = node;

    while (
      currentNode &&
      currentNode.parent &&
      currentNode.parent.type !== "DOCUMENT" &&
      currentNode.parent.type !== "PAGE"
    ) {
      path.unshift(currentNode.name || currentNode.type);
      currentNode = currentNode.parent;
    }

    return path.length > 0 ? path.join(" > ") : node.name || node.type;
  }

  // Start checking from all pages or specific page if pageId is provided
  const pagesToSearch = pageId
    ? figma.root.children.filter((page) => page.id === pageId)
    : figma.root.children;

  console.log(
    `🔍 Searching in ${pagesToSearch.length} page(s)${
      pageId ? ` (filtered by pageId: ${pageId})` : " (all pages)"
    }`
  );

  if (pageId && pagesToSearch.length === 0) {
    console.warn(`⚠️ No page found with ID: ${pageId}`);
    return boundNodes;
  }

  const startTime = Date.now();

  pagesToSearch.forEach((page) => {
    if (page.type === "PAGE") {
      console.log(`  📄 Searching page: "${page.name}" (${page.id})`);
      if (instancesOnly) {
        // When instancesOnly is true, only start from instances
        const findInstancesInNode = (node: SceneNode): void => {
          if (node.type === "INSTANCE") {
            checkNode(node);
          }
          // Continue searching for instances in children
          if ("children" in node && node.children) {
            node.children.forEach((child) => findInstancesInNode(child));
          }
        };
        page.children.forEach((child) => findInstancesInNode(child));
      } else {
        // Normal behavior - check all nodes
        page.children.forEach((child) => checkNode(child));
      }
    }
  });

  const endTime = Date.now();
  const searchTime = endTime - startTime;
  console.log(
    `✅ Search completed in ${searchTime}ms. Found ${boundNodes.length} nodes.`
  );
  console.log(
    `   📊 Performance: Cached ${variableCache.size} variables, ${variableKeyCache.size} keys, ${targetVariableIds.size} target IDs`
  );

  return boundNodes;
}

/**
 * Helper function to get a summary of where a variable is used
 * @param variable - The variable to analyze
 * @param instancesOnly - If true, only search within instances
 * @returns Object with usage statistics and node list
 */
export function getVariableUsageSummary(
  variable: Variable,
  instancesOnly: boolean = false,
  pageId?: string | null
) {
  const boundNodes = findNodesWithBoundVariable(
    variable,
    instancesOnly,
    pageId
  );

  const summary = {
    totalNodes: boundNodes.length,
    nodesByType: {} as Record<string, number>,
    propertyUsage: {} as Record<string, number>,
    nodes: boundNodes,
  };

  boundNodes.forEach(({ node, boundProperties }) => {
    // Count by node type
    summary.nodesByType[node.type] = (summary.nodesByType[node.type] || 0) + 1;

    // Count by property type
    boundProperties.forEach((prop) => {
      const baseProperty = prop.split("[")[0].split(".")[0]; // Extract base property name
      summary.propertyUsage[baseProperty] =
        (summary.propertyUsage[baseProperty] || 0) + 1;
    });
  });

  return summary;
}

/**
 * Example usage:
 *
 * // Get a specific variable by ID
 * const variable = figma.variables.getVariableById('your-variable-id');
 * if (variable) {
 *   const boundNodes = findNodesWithBoundVariable(variable);
 *   console.log(`Variable "${variable.name}" is used in ${boundNodes.length} nodes:`);
 *
 *   boundNodes.forEach(({ node, boundProperties, propertyPath }) => {
 *     console.log(`- ${node.name} (${node.type}): ${boundProperties.join(', ')}`);
 *     console.log(`  Path: ${propertyPath}`);
 *   });
 *
 *   // Or get a summary
 *   const summary = getVariableUsageSummary(variable);
 *   console.log('Usage summary:', summary);
 * }
 *
 * // Find all color variables and their usage
 * const allVariables = figma.variables.getLocalVariables();
 * const colorVariables = allVariables.filter(v => v.resolvedType === 'COLOR');
 *
 * colorVariables.forEach(variable => {
 *   const usage = getVariableUsageSummary(variable);
 *   if (usage.totalNodes > 0) {
 *     console.log(`${variable.name}: used in ${usage.totalNodes} nodes`);
 *   }
 * });
 */
