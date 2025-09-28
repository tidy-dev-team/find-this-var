import {
  Button,
  Columns,
  Container,
  Muted,
  render,
  Text,
  TextboxNumeric,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { h } from "preact";
import { useCallback, useState, useEffect } from "preact/hooks";

import {
  CloseHandler,
  CreateRectanglesHandler,
  GetColorVariablesHandler,
  ColorVariablesResultHandler,
  ColorVariable,
} from "./types";

function Plugin() {
  const [colorVariables, setColorVariables] = useState<ColorVariable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Listen for color variables result
    const unsubscribe = on<ColorVariablesResultHandler>(
      "COLOR_VARIABLES_RESULT",
      (variables: ColorVariable[]) => {
        setColorVariables(variables);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleGetColorVariables = useCallback(() => {
    setIsLoading(true);
    emit<GetColorVariablesHandler>("GET_COLOR_VARIABLES");
  }, []);

  const formatColor = (rgba: {
    r: number;
    g: number;
    b: number;
    a: number;
  }): string => {
    const r = Math.round(rgba.r * 255);
    const g = Math.round(rgba.g * 255);
    const b = Math.round(rgba.b * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getColorPreview = (
    variable: ColorVariable
  ): { color: string; isAlias: boolean } => {
    // Get the first mode's color value for preview
    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length > 0) {
      const firstModeValue = variable.valuesByMode[modeIds[0]];

      // Check if it's an RGBA color
      if (
        typeof firstModeValue === "object" &&
        firstModeValue !== null &&
        "r" in firstModeValue
      ) {
        return {
          color: formatColor(
            firstModeValue as { r: number; g: number; b: number; a: number }
          ),
          isAlias: false,
        };
      }

      // If it's a string (variable alias), return a default color but mark as alias
      if (typeof firstModeValue === "string") {
        return {
          color: "#cccccc", // Light gray for aliases
          isAlias: true,
        };
      }
    }
    return { color: "#000000", isAlias: false };
  };

  const getDisplayValue = (variable: ColorVariable): string => {
    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length > 0) {
      const firstModeValue = variable.valuesByMode[modeIds[0]];

      // Check if it's an RGBA color
      if (
        typeof firstModeValue === "object" &&
        firstModeValue !== null &&
        "r" in firstModeValue
      ) {
        return formatColor(
          firstModeValue as { r: number; g: number; b: number; a: number }
        );
      }

      // If it's a string (variable alias), return the string
      if (typeof firstModeValue === "string") {
        return firstModeValue;
      }
    }
    return "No value";
  };

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Button
        fullWidth
        onClick={handleGetColorVariables}
        secondary
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Get Color Variables"}
      </Button>
      <VerticalSpace space="medium" />

      {colorVariables.length > 0 && (
        <div>
          <Text>
            <Muted>
              Found {colorVariables.length} color variable
              {colorVariables.length !== 1 ? "s" : ""}:
            </Muted>
          </Text>
          <VerticalSpace space="small" />
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {colorVariables.map((variable) => {
              const preview = getColorPreview(variable);
              const displayValue = getDisplayValue(variable);
              return (
                <div
                  key={variable.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                    padding: "8px",
                    borderRadius: "4px",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: preview.color,
                      borderRadius: "3px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      // Add diagonal stripes pattern for aliases
                      backgroundImage: preview.isAlias
                        ? "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)"
                        : "none",
                    }}
                  ></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {variable.name}
                      {!variable.isLocal && (
                        <span style={{ color: "#888", fontWeight: "normal" }}>
                          {" "}
                          (external
                          {variable.libraryName
                            ? ` - ${variable.libraryName}`
                            : ""}
                          )
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayValue}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && colorVariables.length === 0 && (
        <Text>
          <Muted>
            No color variables found. Try creating some color variables in your
            Figma file first.
          </Muted>
        </Text>
      )}
    </Container>
  );
}

export default render(Plugin);
