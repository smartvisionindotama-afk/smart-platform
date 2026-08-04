# SP-010 - SMART UI ARCHITECTURE

> **Document Code** : SP-010  
> **Document Name** : SMART UI Architecture  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan arsitektur UI pada SMART Platform.

Dokumen ini menjadi standar untuk:

- Design System.
- Component Library.
- Theme Management.
- Workspace.
- Layout Architecture.
- Application Interface.

---

# UI VISION

SMART UI merupakan sistem tampilan terpadu untuk seluruh aplikasi SMART Platform.

Prinsip:

> Build once, use everywhere.

Komponen UI tidak dibuat ulang pada setiap aplikasi.

---

# UI ARCHITECTURE POSITION

SMART UI berada pada SMART Framework.

```
Application

        |

SMART.UI

        |

SMART Framework

        |

Platform
```

---

# UI PRINCIPLE

SMART UI menggunakan prinsip:

```
Consistent

Reusable

Accessible

Responsive

Enterprise Ready

Brandable
```

---

# UI RESPONSIBILITY

SMART.UI bertanggung jawab terhadap:

- Component.
- Layout.
- Theme.
- Design Token.
- Interaction Pattern.
- User Experience Standard.

---

# APPLICATION UI RULE

Application hanya bertanggung jawab terhadap:

```
Business Page

Business Workflow

Business Component
```

---

# APPLICATION TIDAK BOLEH

Membuat ulang:

```
Button

Modal

Table

Form

Layout

Theme

Navigation

Notification
```

jika sudah tersedia di SMART.UI.

---

# UI ARCHITECTURE LAYER

Struktur:

```
SMART.UI

├── Design Token

├── Component Library

├── Layout System

├── Theme Engine

├── Workspace Engine

└── Interaction Pattern
```

---

# DESIGN TOKEN SYSTEM

Design Token menjadi sumber standar visual.

---

# TOKEN CATEGORY

```
Color

Typography

Spacing

Radius

Shadow

Animation

Breakpoint
```

---

# COLOR TOKEN

Mengatur:

- Primary Color.
- Secondary Color.
- Background.
- Surface.
- Text.
- Border.
- Status.

---

# TYPOGRAPHY TOKEN

Mengatur:

- Font Family.
- Font Size.
- Weight.
- Line Height.

---

# SPACING TOKEN

Mengatur jarak standar:

```
Small

Medium

Large

Extra Large
```

---

# RADIUS TOKEN

Mengatur:

- Card radius.
- Button radius.
- Input radius.

---

# SHADOW TOKEN

Mengatur:

- Elevation.
- Depth.
- Floating Element.

---

# ANIMATION TOKEN

Mengatur:

- Transition.
- Loading.
- Interaction Feedback.

---

# COMPONENT LIBRARY

SMART.UI menyediakan component standar.

---

# BASIC COMPONENT

```
Button

Input

Select

Checkbox

Radio

Badge

Icon
```

---

# DISPLAY COMPONENT

```
Card

StatCard

Avatar

Alert

Notification
```

---

# DATA COMPONENT

```
Table

DataGrid

Pagination

Filter

Search
```

---

# FEEDBACK COMPONENT

```
Modal

Dialog

Toast

Loading

Empty State
```

---

# LAYOUT COMPONENT

```
AppShell

PageContainer

Sidebar

Topbar

ContentArea
```

---

# FORM ARCHITECTURE

Form menggunakan standar:

```
Form

↓

Field Component

↓

Validation

↓

Submit Handler
```

---

# TABLE ARCHITECTURE

Table harus mendukung:

```
Sorting

Filtering

Pagination

Search

Export
```

---

# LAYOUT SYSTEM

SMART UI menggunakan layout engine.

---

# STANDARD LAYOUT

```
Application Shell

├── Topbar

├── Sidebar

├── Content

└── Footer
```

---

# APPSHELL

AppShell menjadi container utama aplikasi.

Responsibility:

- Navigation.
- Workspace.
- Theme.
- User Context.

---

# THEME ENGINE

Theme Engine mengelola branding.

---

# COMPANY BRANDING

Setiap Company dapat memiliki:

```
Logo

Primary Color

Secondary Color

Theme Preference
```

---

# THEME FLOW

```
User Login

↓

Company Context

↓

Load Theme

↓

Render Application
```

---

# WORKSPACE ENGINE

Workspace mengatur pengalaman kerja.

---

# PURPOSE

Workspace memungkinkan satu Framework mendukung berbagai jenis aplikasi.

---

# EXAMPLE WORKSPACE

```
Corporate Workspace

Warehouse Workspace

POS Workspace

Dashboard Workspace
```

---

# WORKSPACE FLOW

```
Application

↓

Workspace

↓

Layout

↓

Component
```

---

# RESPONSIVE DESIGN

SMART UI harus mendukung:

```
Desktop

Tablet

Mobile
```

---

# ACCESSIBILITY

SMART UI memperhatikan:

- Readability.
- Keyboard navigation.
- Clear interaction.
- User feedback.

---

# UI SECURITY

UI bukan pengganti security.

UI hanya menampilkan berdasarkan:

```
Authentication

↓

Permission

↓

Access
```

---

# PERMISSION BASED UI

Contoh:

Jika user tidak memiliki:

```
inventory.product.delete
```

maka:

```
Delete Button

tidak ditampilkan.
```

---

# UI DEVELOPMENT RULE

Developer wajib:

✓ Menggunakan SMART.UI.

✓ Menggunakan Design Token.

✓ Menggunakan Theme Engine.

✓ Menggunakan Workspace.

✓ Menjaga konsistensi.

---

# DILARANG

```
Hardcoded Color

Duplicate Component

Inline Theme

Application Specific UI Framework

Different Design System
```

---

# UI TESTING

Testing meliputi:

```
Component Test

Interaction Test

Responsive Test

Accessibility Test
```

---

# UI VERSIONING

SMART.UI menggunakan versioning.

Contoh:

```
1.0.0

1.1.0

2.0.0
```

---

# UI SUCCESS CRITERIA

SMART UI Architecture berhasil apabila:

✓ Semua aplikasi memiliki tampilan konsisten.

✓ Developer membuat aplikasi lebih cepat.

✓ Branding Company tetap fleksibel.

✓ Component dapat digunakan ulang.

✓ User Experience meningkat.

---

# FINAL STATEMENT

```
SMART.UI

is not just a design system.

It is the user experience foundation

of SMART Platform.
```

SMART UI memastikan seluruh aplikasi SMART Platform memiliki kualitas tampilan enterprise yang konsisten.

---

**Next Document**

➡ SP-011 - SMART AUTHENTICATION & IDENTITY ARCHITECTURE