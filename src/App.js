import "./App.css";

import { Helmet } from "react-helmet";
import Invoice from "./Invoice";
import React from "react";

// import logo from "./logo.svg";

function App() {
  return (
    <div className="App">
      <Helmet>
        <html lang="en_US" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta charSet="utf-8" />
        <title>Invoice Maker</title>
      </Helmet>
      <Invoice />
    </div>
  );
}

export default App;
