import React from "react";

function Dropdown({ options, selected, classNameDropdown, handleChange }) {
  return (
    <select
      onChange={handleChange}
      className={`select-box ${classNameDropdown}`}
      value={selected.text}
    >
      {options &&
        options.map((option) => <option key={option.id}>{option.text}</option>)}
    </select>
  );
}

export default Dropdown;
