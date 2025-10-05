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

  /**
   * Helper function to check if a variable alias matches our target variable
   */
  function isMatchingVariable(boundVar: VariableAlias): boolean {
    if (boundVar.id === variableId) {
      return true;
    }
    // Check by key for imported variables
    try {
      const referencedVar = figma.variables.getVariableById(boundVar.id);
      if (referencedVar && referencedVar.key === variableKey) {
        return true;
      }
    } catch (error) {
      // Variable might not be accessible
    }
    return false;
  }

  /**
   * Recursively check a node and its children for variable bindings
   */
  function checkNode(node: SceneNode): void {
    const boundProperties: string[] = [];

    try {

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
      if (node.boundVariables.width && isMatchingVariable(node.boundVariables.width)) {
        boundProperties.push("width");
      }
      if (node.boundVariables.height && isMatchingVariable(node.boundVariables.height)) {
        boundProperties.push("height");
      }

      // Layout properties (auto-layout nodes)
      if (node.boundVariables.paddingLeft && isMatchingVariable(node.boundVariables.paddingLeft)) {
        boundProperties.push("paddingLeft");
      }
      if (node.boundVariables.paddingRight && isMatchingVariable(node.boundVariables.paddingRight)) {
        boundProperties.push("paddingRight");
      }
      if (node.boundVariables.paddingTop && isMatchingVariable(node.boundVariables.paddingTop)) {
        boundProperties.push("paddingTop");
      }
      if (node.boundVariables.paddingBottom && isMatchingVariable(node.boundVariables.paddingBottom)) {
        boundProperties.push("paddingBottom");
      }
      if (node.boundVariables.itemSpacing && isMatchingVariable(node.boundVariables.itemSpacing)) {
        boundProperties.push("itemSpacing");
      }
      if (node.boundVariables.counterAxisSpacing && isMatchingVariable(node.boundVariables.counterAxisSpacing)) {
        boundProperties.push("counterAxisSpacing");
      }

      // Text properties (text nodes only)
      if (node.type === "TEXT") {
        if (node.boundVariables.characters && isMatchingVariable(node.boundVariables.characters)) {
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
          if (effect.boundVariables?.color && isMatchingVariable(effect.boundVariables.color)) {
            boundProperties.push(`effects[${index}].color`);
          }
          if (effect.boundVariables?.offset?.x && isMatchingVariable(effect.boundVariables.offset.x)) {
            boundProperties.push(`effects[${index}].offset.x`);
          }
          if (effect.boundVariables?.offset?.y && isMatchingVariable(effect.boundVariables.offset.y)) {
            boundProperties.push(`effects[${index}].offset.y`);
          }
          if (effect.boundVariables?.radius && isMatchingVariable(effect.boundVariables.radius)) {
            boundProperties.push(`effects[${index}].radius`);
          }
          if (effect.boundVariables?.spread && isMatchingVariable(effect.boundVariables.spread)) {
            boundProperties.push(`effects[${index}].spread`);
          }
        }
        if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
          if (effect.boundVariables?.radius && isMatchingVariable(effect.boundVariables.radius)) {
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
        console.warn(`Skipping node ${node.id} due to component property error:`, error);
      }
    }

    // If any properties are bound to this variable, add the node to results
    if (boundProperties.length > 0) {
      boundNodes.push({
        node,
        boundProperties,
        propertyPath: getNodePath(node),
        pageName: getNodePage(node),
      });
    }

    // Recursively check children
    if ("children" in node && node.children) {
      node.children.forEach((child) => checkNode(child));
    }
    } catch (error) {
      // Skip nodes that throw errors during property access
      console.warn(`Skipping node ${node.id} (${node.name}) due to error:`, error);
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

  pagesToSearch.forEach((page) => {
    if (page.type === "PAGE") {
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
  const boundNodes = findNodesWithBoundVariable(variable, instancesOnly, pageId);

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
