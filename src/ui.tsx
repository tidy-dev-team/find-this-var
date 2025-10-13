import {
  Button,
  Checkbox,
  Columns,
  Container,
  Dropdown,
  DropdownOption,
  Muted,
  render,
  Text,
  Textbox,
  TextboxNumeric,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { h, Fragment } from "preact";
import { useCallback, useState, useEffect } from "preact/hooks";

import {
  CloseHandler,
  CreateRectanglesHandler,
  GetColorVariablesHandler,
  ColorVariablesResultHandler,
  FindBoundNodesHandler,
  FindBoundNodesCompleteHandler,
  SearchProgressHandler,
  StreamingResultHandler,
  CancelSearchHandler,
  GetCollectionsHandler,
  CollectionsResultHandler,
  GetPagesHandler,
  PagesResultHandler,
  ColorVariable,
  VariableCollection,
  Page,
} from "./types";

function Plugin() {
  const [colorVariables, setColorVariables] = useState<ColorVariable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(
    new Set()
  );
  const [collections, setCollections] = useState<VariableCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // PHASE 2: Progress tracking state
  const [searchProgress, setSearchProgress] =
    useState<{
      current: number;
      total: number;
      percentage: number;
      nodesFound: number;
    } | null>(null);
  const [streamingResults, setStreamingResults] = useState<
    Array<{
      variableId: string;
      variableName: string;
      instanceNode: {
        id: string;
        name: string;
        type: string;
        pageName: string;
      };
    }>
  >([]);

  useEffect(() => {
    emit<GetCollectionsHandler>("GET_COLLECTIONS");
    emit<GetPagesHandler>("GET_PAGES");

    const unsubscribe1 = on<ColorVariablesResultHandler>(
      "COLOR_VARIABLES_RESULT",
      (variables: ColorVariable[]) => {
        setColorVariables(variables);
        setIsLoading(false);
      }
    );

    const unsubscribe2 = on<CollectionsResultHandler>(
      "COLLECTIONS_RESULT",
      (collections: VariableCollection[]) => {
        setCollections(collections);
        if (collections.length > 0 && selectedCollectionId === null) {
          setSelectedCollectionId(collections[0].id);
        }
      }
    );

    const unsubscribe3 = on<FindBoundNodesCompleteHandler>(
      "FIND_BOUND_NODES_COMPLETE",
      () => {
        setIsSearching(false);
        setSearchProgress(null);
      }
    );

    const unsubscribe4 = on<PagesResultHandler>(
      "PAGES_RESULT",
      (result: { pages: Page[]; currentPageId: string | null }) => {
        setPages(result.pages);
        // PHASE 1 OPTIMIZATION: Default to current page for faster searches
        if (result.currentPageId && selectedPageId === null) {
          setSelectedPageId(result.currentPageId);
        }
      }
    );

    // PHASE 2: Progress tracking listener
    const unsubscribe5 = on<SearchProgressHandler>(
      "SEARCH_PROGRESS",
      (progress) => {
        setSearchProgress(progress);
      }
    );

    // PHASE 2: Streaming results listener
    const unsubscribe6 = on<StreamingResultHandler>(
      "STREAMING_RESULT",
      (result) => {
        setStreamingResults((prev) => [...prev, result]);
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
      unsubscribe5();
      unsubscribe6();
    };
  }, []);

  const handleGetColorVariables = useCallback(() => {
    setIsLoading(true);
    emit<GetColorVariablesHandler>("GET_COLOR_VARIABLES", {
      collectionId: selectedCollectionId,
    });
  }, [selectedCollectionId]);

  const handleSearchChange = useCallback(
    (event: { currentTarget: { value: string } }) => {
      setSearchQuery(event.currentTarget.value);
    },
    []
  );

  // Filter variables based on search query and sort alphabetically
  const filteredVariables = colorVariables
    .filter((variable) =>
      variable.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleVariableSelect = useCallback(
    (variableId: string, checked: boolean) => {
      setSelectedVariables((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(variableId);
        } else {
          newSet.delete(variableId);
        }
        return newSet;
      });
    },
    []
  );

  const handleSelectAll = useCallback(
    (event: { currentTarget: { checked: boolean } }) => {
      const checked = event.currentTarget.checked;
      if (checked) {
        setSelectedVariables(new Set(filteredVariables.map((v) => v.id)));
      } else {
        setSelectedVariables(new Set());
      }
    },
    [filteredVariables]
  );

  const handleGetSelected = useCallback(() => {
    const selectedVariableIds = Array.from(selectedVariables);
    if (selectedVariableIds.length > 0) {
      console.log(
        `🚀 Finding bound nodes for ${selectedVariableIds.length} selected variables...`
      );
      setIsSearching(true);
      setSearchProgress(null);
      setStreamingResults([]);
      emit<FindBoundNodesHandler>("FIND_BOUND_NODES", {
        variableIds: selectedVariableIds,
        pageId: selectedPageId,
      });
    }
  }, [selectedVariables, selectedPageId]);

  const handleCancelSearch = useCallback(() => {
    emit<CancelSearchHandler>("CANCEL_SEARCH");
    setIsSearching(false);
    setSearchProgress(null);
  }, []);

  const handleCollectionChange = useCallback(
    (event: { currentTarget: { value: string } }) => {
      setSelectedCollectionId(event.currentTarget.value || null);
    },
    []
  );

  const handlePageChange = useCallback(
    (event: { currentTarget: { value: string } }) => {
      setSelectedPageId(event.currentTarget.value || null);
    },
    []
  );

  const isAllSelected =
    filteredVariables.length > 0 &&
    filteredVariables.every((v) => selectedVariables.has(v.id));
  const isPartiallySelected =
    filteredVariables.some((v) => selectedVariables.has(v.id)) &&
    !isAllSelected;

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
    // Use the default mode's color value for preview
    const defaultModeValue = variable.valuesByMode[variable.defaultModeId];

    if (defaultModeValue) {
      // Check if it's an RGBA color
      if (
        typeof defaultModeValue === "object" &&
        defaultModeValue !== null &&
        "r" in defaultModeValue
      ) {
        return {
          color: formatColor(
            defaultModeValue as { r: number; g: number; b: number; a: number }
          ),
          isAlias: false,
        };
      }

      // If it's a string (variable alias), return a default color but mark as alias
      if (typeof defaultModeValue === "string") {
        return {
          color: "#cccccc", // Light gray for aliases
          isAlias: true,
        };
      }
    }
    return { color: "#000000", isAlias: false };
  };

  const getDisplayValue = (variable: ColorVariable): string => {
    // Use the default mode's value for display
    const defaultModeValue = variable.valuesByMode[variable.defaultModeId];

    if (defaultModeValue) {
      // Check if it's an RGBA color
      if (
        typeof defaultModeValue === "object" &&
        defaultModeValue !== null &&
        "r" in defaultModeValue
      ) {
        return formatColor(
          defaultModeValue as { r: number; g: number; b: number; a: number }
        );
      }

      // If it's a string (variable alias), return the string
      if (typeof defaultModeValue === "string") {
        return defaultModeValue;
      }
    }
    return "No value";
  };

  return (
    <Container
      space="medium"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <VerticalSpace space="large" />
      {collections.length > 0 && (
        <Fragment>
          <Text>
            <Muted>Select collection:</Muted>
          </Text>
          <VerticalSpace space="extraSmall" />
          <Dropdown
            onChange={handleCollectionChange}
            options={[
              { value: "", text: "All collections" },
              ...collections.map((collection) => ({
                value: collection.id,
                text: collection.name,
              })),
            ]}
            value={selectedCollectionId || ""}
          />
          <VerticalSpace space="small" />
        </Fragment>
      )}
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <Text>
            <Muted>
              Found {colorVariables.length} color variable
              {colorVariables.length !== 1 ? "s" : ""}:
            </Muted>
          </Text>
          <VerticalSpace space="small" />
          <Textbox
            onInput={handleSearchChange}
            placeholder="Search variables by name..."
            value={searchQuery}
          />
          <VerticalSpace space="small" />
          {searchQuery && (
            <Text>
              <Muted>
                Showing {filteredVariables.length} of {colorVariables.length}{" "}
                variables
              </Muted>
            </Text>
          )}
          {filteredVariables.length > 0 && (
            <div>
              <div style={{ marginBottom: "8px" }}>
                <Checkbox onChange={handleSelectAll} value={isAllSelected}>
                  <Text>Select all ({selectedVariables.size} selected)</Text>
                </Checkbox>
              </div>
            </div>
          )}
          <VerticalSpace space="small" />
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              padding: "4px",
            }}
          >
            {filteredVariables.length > 0 ? (
              filteredVariables.map((variable) => {
                const preview = getColorPreview(variable);
                const displayValue = getDisplayValue(variable);
                const isSelected = selectedVariables.has(variable.id);
                return (
                  <div
                    key={variable.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "4px",
                      padding: "8px",
                      borderRadius: "4px",
                      backgroundColor: isSelected ? "#e3f2fd" : "#f0f0f0",
                      border: isSelected
                        ? "1px solid #2196f3"
                        : "1px solid transparent",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      handleVariableSelect(variable.id, !isSelected)
                    }
                  >
                    <Checkbox
                      onChange={(event) =>
                        handleVariableSelect(
                          variable.id,
                          event.currentTarget.checked
                        )
                      }
                      value={isSelected}
                      style={{ marginRight: "8px" }}
                    >
                      <span></span>
                    </Checkbox>
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
              })
            ) : (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <Text>
                  <Muted>
                    {searchQuery
                      ? `No variables found matching "${searchQuery}"`
                      : "No variables to display"}
                  </Muted>
                </Text>
              </div>
            )}
          </div>
          <VerticalSpace space="medium" />
          {pages.length > 0 && (
            <Fragment>
              <Text>
                <Muted>Select page to search:</Muted>
              </Text>
              <VerticalSpace space="extraSmall" />
              <Dropdown
                onChange={handlePageChange}
                options={[
                  { value: "", text: "All pages" },
                  ...pages.map((page) => ({
                    value: page.id,
                    text: page.name,
                  })),
                ]}
                value={selectedPageId || ""}
              />
              <VerticalSpace space="small" />
            </Fragment>
          )}
          <Button
            fullWidth
            onClick={handleGetSelected}
            disabled={selectedVariables.size === 0 || isSearching}
          >
            {isSearching
              ? "Searching..."
              : `Find Bound Nodes (${selectedVariables.size} selected)`}
          </Button>

          {/* PHASE 2: Progress and Cancel UI */}
          {isSearching && (
            <Fragment>
              <VerticalSpace space="small" />

              {/* Progress bar - always show when searching */}
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#e0e0e0",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${searchProgress?.percentage || 0}%`,
                      height: "100%",
                      backgroundColor: "#2196f3",
                      transition: "width 0.2s ease",
                    }}
                  ></div>
                </div>
                <VerticalSpace space="extraSmall" />
                <Text>
                  <Muted>
                    {searchProgress
                      ? `${searchProgress.percentage}% (${searchProgress.current}/${searchProgress.total} nodes) - Found: ${searchProgress.nodesFound}`
                      : "Initializing search..."}
                  </Muted>
                </Text>
              </div>
              <VerticalSpace space="small" />

              {/* Streaming results preview */}
              {streamingResults.length > 0 && (
                <Fragment>
                  <div
                    style={{
                      maxHeight: "100px",
                      overflowY: "auto",
                      fontSize: "11px",
                      padding: "8px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "4px",
                    }}
                  >
                    {streamingResults.slice(-5).map((result, idx) => (
                      <div key={idx} style={{ marginBottom: "4px" }}>
                        ✓ {result.instanceNode.name} (
                        {result.instanceNode.pageName})
                      </div>
                    ))}
                  </div>
                  <VerticalSpace space="small" />
                </Fragment>
              )}

              {/* Cancel button */}
              <Button fullWidth onClick={handleCancelSearch} danger>
                Cancel Search
              </Button>

              <VerticalSpace space="small" />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e0e0e0",
                    borderTop: "2px solid #2196f3",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                <Text>
                  <Muted>Searching through instances...</Muted>
                </Text>
              </div>
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}
              </style>
            </Fragment>
          )}
          <VerticalSpace space="medium" />
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
