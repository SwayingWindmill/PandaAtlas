export const adminTheme = {
  palette: {
    mode: "light" as const,
    primary: { main: "#1c1917", contrastText: "#ffffff" },
    secondary: { main: "#14532d", contrastText: "#ffffff" },
    background: { default: "#f5f5f4", paper: "#ffffff" },
    text: { primary: "#0c0a09", secondary: "#44403c" },
    error: { main: "#991b1b", contrastText: "#ffffff" },
  },
  components: {
    RaLayout: {
      styleOverrides: {
        root: {
          minWidth: 0,
          maxWidth: "100%",
          "& .RaLayout-appFrame": { minWidth: 0, maxWidth: "100%" },
          "& .RaLayout-contentWithSidebar": { minWidth: 0, maxWidth: "100%" },
          "& .RaLayout-content": { minWidth: 0, maxWidth: "100%" },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44, fontWeight: 700 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: "#1c1917", color: "#ffffff" },
      },
    },
  },
};
