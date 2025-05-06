import React from "react";
import ForgeReconciler, {
  useProductContext
} from "@forge/react";
import { Edit } from "./edit";
import { View } from "./view";

const App = () => {
  const context = useProductContext();
  if (!context) {
    return "This is never displayed...";
  }
  console.log("Entry point:", context.extension.entryPoint); // Debug log

  return context.extension.entryPoint === "edit" ? <Edit /> : <View />;
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
