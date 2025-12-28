---
trigger: always_on
---

# **React Development Standards (2025)**

These instructions outline the core philosophy, technical constraints, and best practices for generating React applications.

## **1\. Core Philosophy**

- **Maintainability:** Generate code that is clean, modular, and easy to read.
- **Mobile-First:** Always design for mobile devices first, then scale up for tablets and desktops.
- **Accessibility (A11y):** Accessibility is not an afterthought; it is a requirement.
- **Performance:** Prioritize lightweight solutions. Avoid heavy dependencies where native APIs suffice.

## **2\. Technical Stack & Constraints**

- **Framework:** React (Functional Components with Hooks).
- **Styling:** Use @material/web and [Customizing Material](https://m3.material.io/foundations/customization). _DO NOT_ use custom CSS!
- **Icons:** lucide-react.
- **State Management:** use `tRPC` and TanStack Query for data fetching and state management.
- **Persistence:** sessionStorage or localStorage for user preferences.

## **3\. Material Design**

- **Utilize** the Material Design system for consistent and modern UI.
- **Design Tokens:** Use design tokens [Design Tokens](https://m3.material.io/foundations/design-tokens/overview)
- **Layout:** Use layout components [Layout](https://m3.material.io/foundations/layout/understanding-layout/overview)

## **4\. Responsive Design (Mobile-First)**

- **Breakpoints:**
  - **Default (Mobile):** Styles applied without a prefix target mobile devices (\< 640px).
  - **sm: (640px):** Small tablets / large phones.
  - **md: (768px):** Tablets / vertical tablets.
  - **lg: (1024px):** Laptops / Desktops.
  - **xl: (1280px):** Large Desktops.
- **Fluid Layouts:** Avoid fixed pixel widths for containers. Use percentages (w-full, w-1/2) or viewport units.
- **Touch Targets:** Ensure interactive elements (buttons, links) are at least 44x44px on touch devices.

## **5\. Accessibility (A11y)**

- **Semantic HTML:** Use \<main\>, \<nav\>, \<article\>, \<header\>, \<footer\>, and \<section\> instead of nested \<div\> soup.
- **Keyboard Navigation:**
  - Ensure all interactive elements are focusable.
  - Provide distinct focus styles using focus:ring or focus-visible:.
  - Include a "Skip to content" link for main navigation.
- **Images:** All \<img\> tags must have an alt attribute. Use alt="" for purely decorative images.
- **Contrast:** Ensure text color contrast ratios meet WCAG AA standards.

## **6\. Internationalization (I18n)**

- **Requirement:** Applications must support **English (en)** and **German (de)**.
- **Implementation:**
  - Store translations in a dictionary object or JSON file within the component (if single-file) or separate files.
  - **Do not** hardcode text strings in JSX; use the translation dictionary.
- **Persistence:**
  - Detect the user's preferred language on load.
  - Persist language selection in sessionStorage (or localStorage) so it survives page reloads.
- **Formatting:** Use Intl.NumberFormat and Intl.DateTimeFormat for locale-aware data formatting.

## **7\. Example Component Structure**

// Imports  
import React, { useState, useEffect } from 'react';  
import { Menu } from 'lucide-react';

// Dictionary  
const t \= {  
 en: { greeting: "Hello World" },  
 de: { greeting: "Hallo Welt" }  
};

const App \= () \=\> {  
 // 1\. State  
 const \[lang, setLang\] \= useState('en');

// 2\. Effects (Persistence)  
 useEffect(() \=\> {  
 const saved \= sessionStorage.getItem('lang');  
 if (saved) setLang(saved);  
 }, \[\]);

// 3\. Render  
 return (  
 \<main\>  
 \<h1\>{t\[lang\].greeting}\</h1\>  
 {/\* ... \*/}  
 \</main\>  
 );  
};
