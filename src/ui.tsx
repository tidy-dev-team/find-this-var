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

  const getColorPreview = (variable: ColorVariable): string => {
    // Get the first mode's color value for preview
    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length > 0) {
      const firstModeValue = variable.valuesByMode[modeIds[0]];
      return formatColor(firstModeValue);
    }
    return "#000000";
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
              const previewColor = getColorPreview(variable);
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
                      backgroundColor: previewColor,
                      borderRadius: "3px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
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
                      {previewColor}
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
