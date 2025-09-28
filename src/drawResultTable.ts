import { BoundNodeInfo } from "./findBoundVariables";

interface VariableResult {
  variable: Variable;
  boundNodes: BoundNodeInfo[];
  summary: {
    totalNodes: number;
    nodesByType: Record<string, number>;
    propertyUsage: Record<string, number>;
  };
  componentsOnly: boolean;
}

/**
 * Creates a visual table-like representation of variable usage results
 * @param results Array of variable results to visualize
 * @returns The created frame containing all result tables
 */
export function createResultTable(results: VariableResult[]): FrameNode {
  // Create main container frame
  const mainFrame = figma.createFrame();
  mainFrame.name = "Variable Usage Results";
  mainFrame.layoutMode = "VERTICAL";
  mainFrame.primaryAxisSizingMode = "AUTO";
  mainFrame.counterAxisSizingMode = "AUTO";
  mainFrame.paddingTop = 24;
  mainFrame.paddingBottom = 24;
  mainFrame.paddingLeft = 24;
  mainFrame.paddingRight = 24;
  mainFrame.itemSpacing = 24;
  mainFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
  mainFrame.cornerRadius = 12;

  // Add to current page
  figma.currentPage.appendChild(mainFrame);

  results.forEach((result, resultIndex) => {
    const tableFrame = createSingleVariableTable(result, resultIndex);
    mainFrame.appendChild(tableFrame);
  });

  // Position the main frame
  mainFrame.x = 100;
  mainFrame.y = 100;

  // Focus on the created frame
  figma.viewport.scrollAndZoomIntoView([mainFrame]);
  figma.currentPage.selection = [mainFrame];

  return mainFrame;
}

/**
 * Creates a single variable result table
 */
function createSingleVariableTable(
  result: VariableResult,
  index: number
): FrameNode {
  const { variable, boundNodes, summary, componentsOnly } = result;

  // Create table frame
  const tableFrame = figma.createFrame();
  tableFrame.name = `Table_${variable.name}`;
  tableFrame.layoutMode = "VERTICAL";
  tableFrame.primaryAxisSizingMode = "AUTO";
  tableFrame.counterAxisSizingMode = "AUTO";
  tableFrame.paddingTop = 20;
  tableFrame.paddingBottom = 20;
  tableFrame.paddingLeft = 20;
  tableFrame.paddingRight = 20;
  tableFrame.itemSpacing = 16;
  tableFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  tableFrame.cornerRadius = 8;
  tableFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  tableFrame.strokeWeight = 1;

  // Header section
  const headerFrame = createHeaderSection(
    variable,
    boundNodes.length,
    componentsOnly
  );
  tableFrame.appendChild(headerFrame);

  // Nodes list section
  if (boundNodes.length > 0) {
    const nodesFrame = createNodesSection(boundNodes);
    tableFrame.appendChild(nodesFrame);
  }

  return tableFrame;
}

/**
 * Gets the color value from a variable (first mode)
 */
function getVariableColor(variable: Variable): {
  r: number;
  g: number;
  b: number;
} {
  const modeIds = Object.keys(variable.valuesByMode);
  if (modeIds.length > 0) {
    const firstModeValue = variable.valuesByMode[modeIds[0]];

    // Check if it's an RGBA color
    if (
      typeof firstModeValue === "object" &&
      firstModeValue !== null &&
      "r" in firstModeValue
    ) {
      const rgba = firstModeValue as {
        r: number;
        g: number;
        b: number;
        a: number;
      };
      return { r: rgba.r, g: rgba.g, b: rgba.b };
    }
  }

  // Fallback to gray if can't resolve color
  return { r: 0.5, g: 0.5, b: 0.5 };
}

/**
 * Creates the header section with color preview, variable name and usage count
 */
function createHeaderSection(
  variable: Variable,
  nodeCount: number,
  componentsOnly: boolean
): FrameNode {
  const headerFrame = figma.createFrame();
  headerFrame.name = "Header";
  headerFrame.layoutMode = "HORIZONTAL";
  headerFrame.primaryAxisSizingMode = "AUTO";
  headerFrame.counterAxisSizingMode = "AUTO";
  headerFrame.itemSpacing = 16;
  headerFrame.counterAxisAlignItems = "CENTER";
  headerFrame.fills = [];

  // Color sample rectangle
  const colorRect = figma.createRectangle();
  colorRect.name = "ColorSample";
  colorRect.resize(40, 24);
  colorRect.cornerRadius = 6;

  // Get the variable color
  const variableColor = getVariableColor(variable);
  colorRect.fills = [{ type: "SOLID", color: variableColor }];

  // Add subtle border
  colorRect.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  colorRect.strokeWeight = 1;

  headerFrame.appendChild(colorRect);

  // Variable info section (vertical layout for name and count)
  const variableInfoFrame = figma.createFrame();
  variableInfoFrame.name = "VariableInfo";
  variableInfoFrame.layoutMode = "VERTICAL";
  variableInfoFrame.primaryAxisSizingMode = "AUTO";
  variableInfoFrame.counterAxisSizingMode = "AUTO";
  variableInfoFrame.itemSpacing = 4;
  variableInfoFrame.fills = [];

  // Variable name
  const nameText = figma.createText();
  nameText.characters = `📌 Variable: "${variable.name}" (${variable.resolvedType})`;
  nameText.fontSize = 16;
  nameText.fontName = { family: "Inter", style: "Bold" };
  nameText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  variableInfoFrame.appendChild(nameText);

  // Usage count
  const countText = figma.createText();
  countText.characters = `Used in ${nodeCount} nodes${
    componentsOnly ? " (components only)" : ""
  }`;
  countText.fontSize = 14;
  countText.fontName = { family: "Inter", style: "Regular" };
  countText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
  variableInfoFrame.appendChild(countText);

  headerFrame.appendChild(variableInfoFrame);

  return headerFrame;
}

/**
 * Creates the nodes list section
 */
function createNodesSection(boundNodes: BoundNodeInfo[]): FrameNode {
  const nodesFrame = figma.createFrame();
  nodesFrame.name = "Nodes";
  nodesFrame.layoutMode = "VERTICAL";
  nodesFrame.primaryAxisSizingMode = "AUTO";
  nodesFrame.counterAxisSizingMode = "AUTO";
  nodesFrame.itemSpacing = 12;
  nodesFrame.fills = [];

  boundNodes.forEach((nodeInfo, index) => {
    const nodeItemFrame = createNodeItem(nodeInfo, index + 1);
    nodesFrame.appendChild(nodeItemFrame);
  });

  return nodesFrame;
}

/**
 * Creates a single node item
 */
function createNodeItem(nodeInfo: BoundNodeInfo, index: number): FrameNode {
  const { node, boundProperties, propertyPath, pageName } = nodeInfo;

  const nodeFrame = figma.createFrame();
  nodeFrame.name = `Node_${index}`;
  nodeFrame.layoutMode = "VERTICAL";
  nodeFrame.primaryAxisSizingMode = "AUTO";
  nodeFrame.counterAxisSizingMode = "AUTO";
  nodeFrame.paddingTop = 12;
  nodeFrame.paddingBottom = 12;
  nodeFrame.paddingLeft = 16;
  nodeFrame.paddingRight = 16;
  nodeFrame.itemSpacing = 4;
  nodeFrame.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
  nodeFrame.cornerRadius = 6;

  // Node title
  const titleText = figma.createText();
  titleText.characters = `${index}. ${node.name || node.type} (${
    node.type
  }) [Page: ${pageName}]`;
  titleText.fontSize = 13;
  titleText.fontName = { family: "Inter", style: "Medium" };
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  nodeFrame.appendChild(titleText);

  // Properties
  const propertiesText = figma.createText();
  propertiesText.characters = `Properties: ${boundProperties.join(", ")}`;
  propertiesText.fontSize = 11;
  propertiesText.fontName = { family: "Inter", style: "Regular" };
  propertiesText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  nodeFrame.appendChild(propertiesText);

  // Path
  const pathText = figma.createText();
  pathText.characters = `Path: ${propertyPath}`;
  pathText.fontSize = 11;
  pathText.fontName = { family: "Inter", style: "Regular" };
  pathText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  nodeFrame.appendChild(pathText);

  return nodeFrame;
}

/**
 * Loads the Inter font (required for text creation)
 */
export async function loadInterFont() {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  } catch (error) {
    console.warn("Could not load Inter font, using system default");
  }
}
