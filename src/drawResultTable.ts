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
  console.log(`🎨 Creating result table for ${results.length} variables...`);

  // Create main container frame
  const mainFrame = figma.createFrame();
  mainFrame.name = `Variable Usage Results ${new Date().toLocaleTimeString()}`;
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
  nameText.fontName = getFontName("Bold");
  nameText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  variableInfoFrame.appendChild(nameText);

  // Usage count
  const countText = figma.createText();
  countText.characters = `Used in ${nodeCount} nodes${
    componentsOnly ? " (components only)" : ""
  }`;
  countText.fontSize = 14;
  countText.fontName = getFontName("Regular");
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

  // Node title (clickable to navigate to node)
  const titleText = figma.createText();
  titleText.characters = `🔗 ${index}. ${node.name || node.type} (${
    node.type
  }) [Page: ${pageName}]`;
  titleText.fontSize = 13;
  titleText.fontName = getFontName("Medium");
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.8 } }]; // Blue color to indicate it's clickable

  // Store the node reference as plugin data so we can navigate to it
  titleText.setPluginData("targetNodeId", node.id);
  titleText.setPluginData("targetPageId", getPageId(node));

  // Add click handler by making it a clickable frame
  const clickableFrame = figma.createFrame();
  clickableFrame.name = `ClickableTitle_${index}`;
  clickableFrame.layoutMode = "HORIZONTAL";
  clickableFrame.primaryAxisSizingMode = "AUTO";
  clickableFrame.counterAxisSizingMode = "AUTO";
  clickableFrame.paddingTop = 4;
  clickableFrame.paddingBottom = 4;
  clickableFrame.paddingLeft = 8;
  clickableFrame.paddingRight = 8;
  clickableFrame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.98, b: 1 } }]; // Very light blue background
  clickableFrame.cornerRadius = 6;
  clickableFrame.strokes = [
    { type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.8 } },
  ];
  clickableFrame.strokeWeight = 1;
  clickableFrame.dashPattern = [2, 2]; // Dashed border to indicate interactivity

  // Add hover effect styling
  clickableFrame.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 1 },
      radius: 2,
      spread: 0,
      visible: false,
      blendMode: "NORMAL",
    },
  ];

  clickableFrame.appendChild(titleText);

  // Store navigation data on the clickable frame
  clickableFrame.setPluginData("targetNodeId", node.id);
  clickableFrame.setPluginData("targetPageId", getPageId(node));
  clickableFrame.setPluginData("isNavigationLink", "true");

  nodeFrame.appendChild(clickableFrame);

  // Properties
  const propertiesText = figma.createText();
  propertiesText.characters = `Properties: ${boundProperties.join(", ")}`;
  propertiesText.fontSize = 11;
  propertiesText.fontName = getFontName("Regular");
  propertiesText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  nodeFrame.appendChild(propertiesText);

  // Path
  const pathText = figma.createText();
  pathText.characters = `Path: ${propertyPath}`;
  pathText.fontSize = 11;
  pathText.fontName = getFontName("Regular");
  pathText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  nodeFrame.appendChild(pathText);

  return nodeFrame;
}

/**
 * Gets the page ID for a given node
 */
function getPageId(node: SceneNode): string {
  let currentNode: BaseNode | null = node;
  while (currentNode && currentNode.parent) {
    if (currentNode.parent.type === "PAGE") {
      return currentNode.parent.id;
    }
    currentNode = currentNode.parent;
  }
  return "";
}

/**
 * Creates text with error handling and font fallbacks
 */
function createTextSafely(
  characters: string,
  fontSize: number,
  fontStyle: "Regular" | "Medium" | "Bold",
  color: RGB
): TextNode {
  const textNode = figma.createText();

  try {
    textNode.fontName = getFontName(fontStyle);
  } catch (error) {
    console.warn(`Font loading failed for ${fontStyle}, using default`);
    // Don't set fontName, let Figma use default
  }

  textNode.characters = characters;
  textNode.fontSize = fontSize;
  textNode.fills = [{ type: "SOLID", color }];

  return textNode;
}

/**
 * Gets the appropriate font family and style, with fallbacks
 */
function getFontName(style: "Regular" | "Medium" | "Bold"): FontName {
  try {
    // Try Inter first
    return { family: "Inter", style };
  } catch {
    try {
      // Fallback to Roboto
      return { family: "Roboto", style };
    } catch {
      // Final fallback - use any available system font
      return { family: "Arial", style };
    }
  }
}

/**
 * Handles navigation to a node when a clickable element is clicked
 * This should be called from a selection change handler in the main plugin
 */
export function handleNavigationClick(selectedNode: SceneNode): boolean {
  // Check if the selected node has navigation data
  const isNavigationLink = selectedNode.getPluginData("isNavigationLink");

  if (isNavigationLink === "true") {
    const targetNodeId = selectedNode.getPluginData("targetNodeId");
    const targetPageId = selectedNode.getPluginData("targetPageId");

    if (targetNodeId && targetPageId) {
      try {
        // Find the target node
        const targetNode = figma.getNodeById(targetNodeId);
        const targetPage = figma.getNodeById(targetPageId);

        if (targetNode && targetPage && targetPage.type === "PAGE") {
          // Switch to the target page if necessary
          if (figma.currentPage.id !== targetPageId) {
            figma.currentPage = targetPage as PageNode;
          }

          // Navigate to the target node
          figma.viewport.scrollAndZoomIntoView([targetNode]);
          figma.currentPage.selection = [targetNode as SceneNode];

          console.log(`🎯 Navigated to: ${targetNode.name || targetNode.type}`);
          return true;
        }
      } catch (error) {
        console.warn("Failed to navigate to node:", error);
      }
    }
  }

  return false;
}

/**
 * Resets font loading state (useful for multiple plugin runs)
 */
export function resetFonts() {
  fontsLoaded = false;
}

/**
 * Loads the Inter font (required for text creation)
 */
let fontsLoaded = false;

export async function loadInterFont() {
  // Only load fonts once per session
  if (fontsLoaded) {
    return;
  }

  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    fontsLoaded = true;
    console.log("✅ Fonts loaded successfully");
  } catch (error) {
    console.warn("Could not load Inter font, trying fallback fonts");
    try {
      // Try common system fonts as fallback
      await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
      await figma.loadFontAsync({ family: "Roboto", style: "Medium" });
      await figma.loadFontAsync({ family: "Roboto", style: "Bold" });
      fontsLoaded = true;
      console.log("✅ Fallback fonts (Roboto) loaded successfully");
    } catch (fallbackError) {
      console.warn("Could not load fallback fonts either, using defaults");
      fontsLoaded = true; // Still mark as loaded to prevent infinite retries
    }
  }
}
