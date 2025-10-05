import { BoundNodeInfo } from "./findBoundVariables";

interface VariableResult {
  variable: Variable;
  boundNodes: BoundNodeInfo[];
  summary: {
    totalNodes: number;
    nodesByType: Record<string, number>;
    propertyUsage: Record<string, number>;
  };
  instancesOnly: boolean;
}

/**
 * Creates a visual table-like representation of variable usage results
 * @param results Array of variable results to visualize
 * @returns The created frame containing all result tables
 */
export function createResultTable(results: VariableResult[]): FrameNode {
  console.log(`🎨 Creating result table for ${results.length} variables...`);

  try {
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

    // Process results with error handling for each variable
    let successfulTables = 0;
    results.forEach((result, resultIndex) => {
      try {
        console.log(
          `Processing variable ${resultIndex + 1}/${results.length}: ${
            result.variable.name
          }`
        );
        const tableFrame = createSingleVariableTable(result, resultIndex);
        mainFrame.appendChild(tableFrame);
        successfulTables++;
      } catch (error) {
        console.error(
          `Failed to create table for variable ${result.variable.name}:`,
          error
        );
        // Continue with other variables
      }
    });

    console.log(
      `✅ Successfully created ${successfulTables}/${results.length} variable tables`
    );

    // Position the main frame
    mainFrame.x = 100;
    mainFrame.y = 100;

    // Focus on the created frame
    figma.viewport.scrollAndZoomIntoView([mainFrame]);
    figma.currentPage.selection = [mainFrame];

    return mainFrame;
  } catch (error) {
    console.error("❌ Failed to create result table:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create result table: ${errorMessage}`);
  }
}

/**
 * Creates a single variable result table
 */
function createSingleVariableTable(
  result: VariableResult,
  index: number
): FrameNode {
  const { variable, boundNodes, summary, instancesOnly } = result;

  // Create table frame
  const tableFrame = figma.createFrame();
  tableFrame.name = `Table_${variable.name}`;
  tableFrame.layoutMode = "VERTICAL";
  tableFrame.primaryAxisSizingMode = "AUTO";
  tableFrame.counterAxisSizingMode = "FIXED"; // Use FIXED and set width manually
  tableFrame.resize(382, tableFrame.height); // Set standard width to match your manual example
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
    instancesOnly
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
  instancesOnly: boolean
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
    instancesOnly ? " (instances only)" : ""
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

  // Filter out invalid nodes and log warnings
  const validBoundNodes = boundNodes.filter((nodeInfo, index) => {
    if (!nodeInfo.node || !nodeInfo.node.id) {
      console.warn(`Skipping invalid node at index ${index}:`, nodeInfo);
      return false;
    }

    // Verify node still exists in the document
    const existingNode = figma.getNodeById(nodeInfo.node.id);
    if (!existingNode) {
      console.warn(
        `Skipping node ${nodeInfo.node.id} - no longer exists in document`
      );
      return false;
    }

    return true;
  });

  console.log(
    `Processing ${validBoundNodes.length} valid nodes out of ${boundNodes.length} total`
  );

  validBoundNodes.forEach((nodeInfo, index) => {
    try {
      const nodeItemFrame = createNodeItem(nodeInfo, index + 1);
      nodesFrame.appendChild(nodeItemFrame);
    } catch (error) {
      console.error(
        `Failed to create node item for ${nodeInfo.node.id}:`,
        error
      );
      // Continue with other nodes
    }
  });

  return nodesFrame;
}

/**
 * Finds the parent component or instance for a given node
 * Traverses up the node tree to find the closest component or instance
 */
function findParentComponent(node: SceneNode): SceneNode | null {
  let currentNode: BaseNode | null = node;
  
  while (currentNode && currentNode.parent) {
    if (currentNode.parent.type === "COMPONENT" || currentNode.parent.type === "INSTANCE") {
      return currentNode.parent as SceneNode;
    }
    currentNode = currentNode.parent;
  }
  
  return null;
}

/**
 * Converts technical property paths to user-friendly names
 * Examples: "fills[0].color" -> "Fill", "strokes[0].color" -> "Stroke", etc.
 */
function getFriendlyPropertyName(propertyPath: string): string {
  const friendlyNames: Record<string, string> = {
    "fills[0].color": "Fill",
    "strokes[0].color": "Stroke",
    "effects[0].color": "Effect Color",
    "effects[0].radius": "Effect Radius",
    "effects[0].offset.x": "Effect Offset X",
    "effects[0].offset.y": "Effect Offset Y",
    "effects[0].spread": "Effect Spread",
    "cornerRadius": "Corner Radius",
    "paddingTop": "Padding Top",
    "paddingBottom": "Padding Bottom",
    "paddingLeft": "Padding Left",
    "paddingRight": "Padding Right",
    "itemSpacing": "Item Spacing",
    "fontSize": "Font Size",
    "fontName": "Font Family",
    "lineHeight": "Line Height",
    "letterSpacing": "Letter Spacing",
    "paragraphSpacing": "Paragraph Spacing",
    "paragraphIndent": "Paragraph Indent",
    "textCase": "Text Case",
    "textDecoration": "Text Decoration",
    "textAlignHorizontal": "Text Align",
    "textAlignVertical": "Text Align Vertical",
  };

  // Check for exact matches first
  if (friendlyNames[propertyPath]) {
    return friendlyNames[propertyPath];
  }

  // Handle array indices patterns like "fills[1].color" -> "Fill 2"
  const arrayPattern = /^(\w+)\[(\d+)\]\.(.+)$/;
  const arrayMatch = propertyPath.match(arrayPattern);
  if (arrayMatch) {
    const [, property, index, subProperty] = arrayMatch;
    const baseName = friendlyNames[`${property}[0].${subProperty}`] || property;
    return `${baseName} ${parseInt(index) + 1}`;
  }

  // Handle simple property names
  const simplePattern = /^(\w+)$/;
  const simpleMatch = propertyPath.match(simplePattern);
  if (simpleMatch) {
    const property = simpleMatch[1];
    // Capitalize first letter and add spaces before capitals
    return property.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  // Fallback: return the original path but cleaner
  return propertyPath.replace(/\[\d+\]/g, match => ` ${parseInt(match.slice(1, -1)) + 1}`).replace(/\./g, ' > ');
}

/**
 * Creates a single node item
 */
function createNodeItem(nodeInfo: BoundNodeInfo, index: number): FrameNode {
  console.log(`Creating node item ${index}:`, nodeInfo);
  const { node, boundProperties, propertyPath, pageName } = nodeInfo;
  
  // Find the parent component or instance for linking
  const targetNode = findParentComponent(node) || node;
  const isComponent = targetNode.type === "COMPONENT" || targetNode.type === "INSTANCE";

  // Validate node exists and has required properties
  if (!node || !node.id) {
    console.warn(`Invalid node in nodeInfo at index ${index}`);
    throw new Error(`Invalid node: ${JSON.stringify(nodeInfo)}`);
  }

  // Check if node still exists in the document
  const existingNode = figma.getNodeById(node.id);
  if (!existingNode) {
    console.warn(`Node ${node.id} no longer exists in the document`);
    throw new Error(`Node no longer exists: ${node.id}`);
  }

  const nodeFrame = figma.createFrame();
  nodeFrame.name = `Node_${index}`;
  nodeFrame.layoutMode = "VERTICAL";
  nodeFrame.primaryAxisSizingMode = "AUTO";
  nodeFrame.counterAxisSizingMode = "AUTO"; // Auto sizing for container width
  nodeFrame.paddingTop = 12;
  nodeFrame.paddingBottom = 12;
  nodeFrame.paddingLeft = 16;
  nodeFrame.paddingRight = 16;
  nodeFrame.itemSpacing = 4;
  nodeFrame.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
  nodeFrame.cornerRadius = 6;

  // Node title (clickable for all nodes)
  const titleText = figma.createText();
  const linkIcon = "🔗"; // Use link icon for all nodes since they all get hyperlinks now
  const titleContent = `${linkIcon} ${index}. ${targetNode.name || targetNode.type} (${
    targetNode.type
  }) [Page: ${pageName}]`;
  console.log(`📝 Creating text with content: "${titleContent}"`);
  
  // Set text properties
  titleText.fontSize = 13;
  titleText.fontName = getFontName("Medium");
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.8 } }]; // Blue color for all linked text

  // Set characters after properties
  titleText.characters = titleContent;
  console.log(
    `✅ Text created successfully with ${titleText.characters.length} characters`
  );

  // Create native Figma hyperlink for all nodes (not just components)
  try {
    console.log(`🔍 Processing node for hyperlink: ${targetNode.id} (${targetNode.type})`);

    const existingNode = figma.getNodeById(targetNode.id);
    console.log(
      `📋 Found existing node: ${existingNode?.id} (${existingNode?.type})`
    );

    if (existingNode && existingNode.type !== "DOCUMENT") {
      // Method 1: Try setRangeHyperlink
      try {
        const titleLink: HyperlinkTarget = {
          type: "NODE",
          value: targetNode.id,
        };
        console.log(
          `🎯 Setting hyperlink for text: "${titleText.characters}" (length: ${titleText.characters.length})`
        );
        titleText.setRangeHyperlink(0, titleText.characters.length, titleLink);
        console.log(
          `✅ Successfully created native hyperlink for node ${targetNode.id}`
        );

        // Verify the hyperlink was set
        const hyperlink = titleText.getRangeHyperlink(
          0,
          titleText.characters.length
        );
        console.log(`🔗 Hyperlink verification:`, hyperlink);

        // If hyperlink is null, try alternative method
        if (!hyperlink) {
          console.log(
            `⚠️ Hyperlink verification failed, trying alternative method...`
          );
          // Try setting hyperlink on the entire text node
          titleText.hyperlink = titleLink;
          console.log(`✅ Set hyperlink using alternative method`);
        }
      } catch (hyperlinkError) {
        console.warn(`❌ setRangeHyperlink failed:`, hyperlinkError);

        // Method 2: Try setting hyperlink property directly
        try {
          const titleLink: HyperlinkTarget = {
            type: "NODE",
            value: targetNode.id,
          };
          titleText.hyperlink = titleLink;
          console.log(`✅ Set hyperlink using direct property method`);
        } catch (directError) {
          console.warn(`❌ Direct hyperlink method also failed:`, directError);
        }
      }
    } else {
      console.log(
        `⏭️ Skipping hyperlink for node ${
          targetNode.id
        } - existingNode: ${!!existingNode}, type: ${existingNode?.type}`
      );
    }
  } catch (error) {
    console.warn(`❌ Failed to set hyperlink for node ${targetNode.id}:`, error);
    console.warn(
      `Error details:`,
      error instanceof Error ? error.stack : String(error)
    );
  }

  // Container frame with styling that indicates clickability
  const linkContainer = figma.createFrame();
  linkContainer.name = `Link_${index}`;
  linkContainer.layoutMode = "HORIZONTAL";
  linkContainer.primaryAxisSizingMode = "AUTO";
  linkContainer.counterAxisSizingMode = "AUTO";
  linkContainer.paddingTop = 4;
  linkContainer.paddingBottom = 4;
  linkContainer.paddingLeft = 8;
  linkContainer.paddingRight = 8;
  // Light blue background for all nodes (since they all get hyperlinks now)
  linkContainer.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.98, b: 1 } }];
  linkContainer.cornerRadius = 6;

  // Blue dashed border for all nodes (since they all get hyperlinks now)
  linkContainer.strokes = [
    { type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.8 } },
  ];
  linkContainer.strokeWeight = 1;
  linkContainer.dashPattern = [2, 2]; // Dashed border to indicate it's a link

  linkContainer.layoutAlign = "STRETCH";

  linkContainer.appendChild(titleText);
  nodeFrame.appendChild(linkContainer);

  // Properties (with friendly names)
  const propertiesText = figma.createText();
  const friendlyProperties = boundProperties.map(prop => getFriendlyPropertyName(prop));
  propertiesText.characters = `Properties: ${friendlyProperties.join(", ")}`;
  propertiesText.fontSize = 11;
  propertiesText.fontName = getFontName("Regular");
  propertiesText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  nodeFrame.appendChild(propertiesText);

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

// Navigation functions removed - using Figma native hyperlinks only

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
