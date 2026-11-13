# MindBoard (RTL Mindmap & Bracket Diagram for Obsidian)

[English](#english) | [فارسی (Persian)](#فارسی)

---

<a name="english"></a>
# English

**MindBoard** is a lightweight, responsive, and flexible Obsidian plugin designed for drawing mindmaps and reverse bracket/logic trees with native support for Right-to-Left (Persian/Arabic) and Left-to-Right workflows.

Rendered purely with SVG paths without heavy third-party dependencies, MindBoard provides real-time visual customization, interactive settings, and vector exports directly inside your vault.

## Table of Contents
1. [Key Features](#features)
2. [Installation](#installation)
3. [Syntax & Markup](#syntax--markup)
4. [Inline Directives](#inline-directives)
5. [On-Chart Interactive Toolbar](#on-chart-interactive-toolbar)
6. [Keyboard Shortcuts & Commands](#keyboard-shortcuts--commands)
7. [Examples](#examples)
8. [Custom CSS Styling](#custom-css-styling)

---

## Features

- **Native RTL & LTR Support:** Built from the ground up to prevent indentation and alignment anomalies in right-to-left scripts.
- **Dual Diagram Engines:**
  1. `mindmap`: Standard horizontal or vertical hierarchical tree structures.
  2. `bracket`: Reverse bracket logic trees with curly braces for premises, syllogisms, and conclusions.
- **On-Chart Interactive Toolbar:** Hover over any diagram to adjust shape, connector style, color palette, direction, arrow markers, or text alignment directly without opening settings.
- **Live Size Sliders:** Preview node and root width adjustments dynamically via interactive sliders.
- **Markdown & Line Breaks:** Supports bold, italics, internal links, and explicit `<br>` line breaks inside node text.
- **High-Resolution Vector Export:** One-click downloads directly to your vault in vector `SVG`, `PNG`, or `JPG` formats.

---

## Installation

### Manual Installation
1. Create a directory named `mindboard` inside your vault plugins directory:  
   `<Vault>/.obsidian/plugins/mindboard/`
2. Place the following release files into the folder:
   - `main.js`
   - `styles.css`
   - `manifest.json`
3. Reload Obsidian, open **Settings** > **Community plugins**, refresh the installed list, and toggle **MindBoard** on.

### Via BRAT (Beta Reviewers Auto-update Tester)
1. Install and enable the **Obsidian42 - BRAT** community plugin.
2. In the BRAT settings, choose **Add Beta plugin**.
3. Enter the repository URL: `https://github.com/amironthegit/mindboard`
4. Confirm to automatically download, install, and track updates.

---

## Syntax & Markup

Diagrams are declared inside markdown code blocks using either `mindmap` or `bracket` as the language tag.

### 1. Mindmap Syntax (`mindmap`)
- **Hierarchy:** Indentation levels (`Tab` or spaces) define parent-child relationships.
- **Arrow Titles (`##`):** Wrap text between `##` markers to render an arrow label bridging to the preceding node (e.g., `Node##Arrow Label##`).
- **Subtle Descriptions (`::`):** Wrap text between `::` markers to display muted, smaller explanatory sub-text beneath a node label (e.g., `Main Node::Detailed sub-note::`).
- **Group Braces (`@@`):** Append `@@Label@@` to adjacent nodes to draw an overarching summary brace grouping those siblings together.

### 2. Bracket Syntax (`bracket`)
- Indentation levels define syllogisms: deeper indentation represents the conclusion or logical deduction stemming from the shallower preceding lines.

---

## Inline Directives

Override global plugin defaults per diagram by placing `@` directives at the beginning of the code block:

| Directive | Supported Values | Description |
| :--- | :--- | :--- |
| `@shape=` | `rounded`, `rect`, `pill`, `circle`, `diamond`, `none` | Geometric shape of node cards |
| `@line=` | `curve`, `straight`, `elbow` | Style of connection paths |
| `@color=` | `branch`, `level`, `sibling` | Color assignment scheme |
| `@bracket=` | `curly`, `square`, `line` | Geometric shape of grouping brackets |
| `@arrow=` | `thin`, `equal`, `implies`, `bar`, `sleek`, `dart`, `bold` | Arrowhead marker design |
| `@dir=` | `rtl`, `ltr`, `ttb`, `btt` | Flow layout direction (Right-to-Left, Left-to-Right, Top-to-Bottom, Bottom-to-Top) |
| `@align=` | `center`, `right`, `left`, `justify` | Text alignment within cards |
| `@rootwidth=` | Number in `em` (e.g., `20`) | Max width limit for the root node |
| `@nodewidth=` | Number in `em` (e.g., `35`) | Max width limit for child nodes |
| `@blockwidth=`| Number in `em` (e.g., `30`) | Max card width in bracket blocks |
| `@leader=` | `on`, `off` | Toggle dotted alignment guides in bracket mode |

---

## On-Chart Interactive Toolbar

Hovering over the top corner of any rendered diagram reveals a quick-access toolbar:

1. **Export Diagram:** Save high-res assets (`SVG`, `PNG`, or `JPG`) directly into your vault.
2. **Toggle Notes (`::`):** Quickly toggle visibility for dimmed sub-notes.
3. **Card Formatting:** Instantly modify shapes, lines, colors, direction, and text alignments for that specific block.
4. **Live Size Adjustment:** Use interactive sliders to alter node width and watch the SVG resize in real-time.

---

## Keyboard Shortcuts & Commands

When editing inside `mindmap` or `bracket` blocks:
- **`Enter`:** Retains the indentation level of the current line.
- **`Tab` / `Shift + Tab`:** Indents or un-indents selected lines.

From the Obsidian Command Palette (`Ctrl/Cmd + P`):
- `RTL Mindmap: Cycle node shapes`
- `RTL Mindmap: Cycle line styles`
- `RTL Mindmap: Cycle color modes`
- `RTL Mindmap: Toggle direction (RTL/LTR)`

---

## Examples

### 1. Hierarchical Mindmap with Notes, Arrows, and Braces

```mindmap
@shape=rounded
@line=curve
@color=branch
Project Launch
	Phase 1: Discovery##Set Objectives##
		Stakeholder Interviews::Weekly sync scheduled::
		Budget & Resources@@Approved by Finance@@
	Phase 2: Execution
		Core Architecture
		Feature Implementation
	Phase 3: QA & Release
		Automated End-to-End Tests
		Security & Penetration Audit
```

### 2. Deductive Bracket Logic Tree

```bracket
@bracket=curly
@shape=pill
@align=center
Premise A: Initial Evidence Collected
Premise B: Verified Records
	Validate Claim
Premise C: Sample Analytics
	Confirm Hypothesis
		Final Deduction##Published Report##
```


### 3. Top-to-Bottom Hierarchy (`ttb`)

```mindmap
@dir=ttb
@shape=pill
@line=elbow
Executive Board
	Engineering Division
		Backend Architecture
		Frontend & UI
	Operations Division
		Finance
		Human Resources
```
````

---

## Custom CSS Styling

Add a custom CSS snippet under **Settings** > **Appearance** > **CSS snippets** to tweak styles globally:

```css
.mm-container {
  /* Branch Color Palette */
  --mm-c0: #2f80ed;
  --mm-c1: #27ae60;
  --mm-c2: #f2994a;
  --mm-c3: #9b51e0;

  /* Spacing */
  --mm-gap-x: 3.5em; /* Level spacing */
  --mm-gap-y: 0.8em; /* Sibling spacing */
}
````

---
---

<a name="فارسی"></a>
# فارسی (Persian)

افزونه‌ی **MindBoard** ابزاری سبک، سریع و منعطف برای ترسیم نقشه‌های ذهنی (Mindmap) و درخت‌های معکوس استدلالی/کروشه‌ای (Bracket / Logic Trees) با پشتیبانی بومی از زبان‌های راست‌به‌چپ (فارسی و عربی) در محیط ابسیدین است.

این افزونه بدون وابستگی به کتابخانه‌های سنگین خارجی، دیاگرام‌ها را به‌صورت برداری SVG رسم کرده و امکان تنظیمات لحظه‌ای، شخصی‌سازی بصری و خروجی باکیفیت تصویری را در اختیارتان می‌گذارد.

## فهرست مطالب
1. [ویژگی‌های کلیدی](#ویژگیهای-کلیدی)
2. [نحوه‌ی نصب و راه‌اندازی](#نحوهی-نصب-و-راهاندازی)
3. [ساختار و نشانه‌گذاری‌ها (Syntax)](#ساختار-و-نشانهگذاریها-syntax)
4. [تنظیمات درون‌بلاک (Inline Directives)](#تنظیمات-درونبلاک-inline-directives)
5. [نوار ابزار روی هر نمودار](#نوار-ابزار-روی-هر-نمودار)
6. [کلیدهای میانبر و دستورات](#کلیدهای-میانبر-و-دستورات)
7. [نمونه‌های کاربردی و الگوها](#نمونههای-کاربردی-و-الگوها)
8. [شخصی‌سازی پیشرفته با CSS](#شخصیسازی-پیشرفته-با-css)

---

## ویژگی‌های کلیدی

- **پشتیبانی کامل از زبان‌های راست‌به‌چپ (RTL) و چپ‌به‌راست (LTR):** طراحی پایه منطبق بر جهت نوشتار فارسی بدون به‌هم‌ریختگی تورفتگی‌ها.
- **دو حالت دیاگرام مجزا:**
  1. `mindmap`: مایندمپ درختی افقی یا عمودی استاندارد.
  2. `bracket`: نمودار درختی معکوس با آکولاد و کروشه جهت نمایش استدلال‌ها و نتیجه‌گیری‌ها.
- **تغییر مشخصات اختصاصی هر بلوک بدون باز کردن تنظیمات:** دکمه‌های نوار ابزار بالای نمودار برای تغییر شکل، نوع خط، تراز متن و رنگ دیاگرام همان بلاک.
- **پیش‌نمایش لایو (Live Preview) برای اسلایدرهای ابعاد:** امکان تنظیم حداکثر عرض عنوان اصلی و گره‌ها به‌صورت آنی با حرکت اسلایدر.
- **پشتیبانی از قالب‌بندی مارک‌داون:** استفاده از بولد، ایتالیک، پیوندهای داخلی و شکست دستی سطر با `<br>`.
- **ابزار خروجی پرقدرت:** دانلود مستقیم نمودار با کیفیت برداری `SVG` یا تصاویر `PNG` و `JPG` در والت.

---

## نحوه‌ی نصب و راه‌اندازی

### نصب دستی
1. پوشه‌ای با نام `mindboard` در مسیر افزونه‌های والت خود بسازید:  
   `<Vault>/.obsidian/plugins/mindboard/`
2. سه فایل افزونه را داخل این پوشه قرار دهید:
   - `main.js`
   - `styles.css`
   - `manifest.json`
3. در تنظیمات ابسیدین به بخش **Community plugins** رفته، فهرست را ریفرش کنید و **MindBoard** را فعال نمایید.

### نصب از طریق افزونه BRAT
1. افزونه **Obsidian42 - BRAT** را در ابسیدین نصب و فعال کنید.
2. در تنظیمات BRAT روی دکمه **Add Beta plugin** بزنید.
3. نشانی مخزن گیت‌هاب را وارد کنید: `https://github.com/amironthegit/mindboard`
4. افزونه به‌صورت خودکار نصب شده و آپدیت‌های بعدی را دریافت می‌کند.

---

## ساختار و نشانه‌گذاری‌ها (Syntax)

دیاگرام‌ها با استفاده از بلاک کد مارک‌داون با زبان `mindmap` یا `bracket` ساخته می‌شوند.

### ۱. نشانه‌های مایندمپ (`mindmap`)
- **ساختار سلسله‌مراتبی:** با کلید `Tab` یا فاصله‌ها سطح والد/فرزند مشخص می‌شود.
- **عنوان با فلش (`##`):** متن بین دو نشانه‌ی `##` با یک فلش به کادر قبلی متصل می‌شود (مثال: `گام اول##هدف##`).
- **توضیحات کمرنگ (`::`):** متن بین دو نشانه‌ی `::` با فونت کوچک‌تر و رنگ ملایم‌تر زیر گره قرار می‌گیرد (مثال: `عنوان گره::توضیحات تکمیلی::`).
- **آکولاد گروهی (`@@`):** با قرار دادن `@@نتیجه@@` در انتهای گره‌های مجاور، آکولاد خلاصه‌سازی دور آن‌ها رسم می‌شود.

### ۲. نشانه‌های بلاک کروشه (`bracket`)
- هرچه تورفتگی (سطح تب) بیشتر باشد، آن عبارت «نتیجه» یا گام بعدیِ ردیف‌های با تورفتگی کمتر قبلی است.

---

## تنظیمات درون‌بلاک (Inline Directives)

مشخصات هر دیاگرام را می‌توانید مستقیماً در خطوط ابتدایی آن بلاک با علامت `@` تعیین کنید:

| دستور درون بلاک | مقادیر معتبر | توضیح |
| :--- | :--- | :--- |
| `@shape=` | `rounded`, `rect`, `pill`, `circle`, `diamond`, `none` | شکل هندسی کادرهای دیاگرام |
| `@line=` | `curve`, `straight`, `elbow` | استایل خطوط اتصال (منحنی، مستقیم، زانویی) |
| `@color=` | `branch`, `level`, `sibling` | حالت رنگ‌آمیزی شاخه‌ها یا سطوح |
| `@bracket=` | `curly`, `square`, `line` | شکل آکولادها (منحنی، کروشه مستطیلی، خط مستقیم) |
| `@arrow=` | `thin`, `equal`, `implies`, `bar`, `sleek`, `dart`, `bold` | استایل فلش‌های هدایت‌کننده |
| `@dir=` | `rtl`, `ltr`, `ttb`, `btt` | جهت ترسیم (راست‌به‌چپ، چپ‌به‌راست، بالا‌به‌پایین، پایین‌به‌بالا) |
| `@align=` | `center`, `right`, `left`, `justify` | تراز متن داخل جعبه‌ها |
| `@rootwidth=` | عدد بر حسب `em` (مثلاً `20`) | حداکثر عرض مجاز برای گره ریشه |
| `@nodewidth=` | عدد بر حسب `em` (مثلاً `35`) | حداکثر عرض مجاز برای سایر گره‌ها |
| `@blockwidth=`| عدد بر حسب `em` (مثلاً `30`) | حداکثر عرض جعبه‌ها در بلاک کروشه |
| `@leader=` | `on`, `off` | فعال/غیرفعال کردن خط‌چین راهنما در بلاک کروشه |

---

## نوار ابزار روی هر نمودار

با بردن نشانگر ماوس روی گوشه بالایی هر نمودار، نوار ابزار ظاهر می‌شود:
1. **دانلود نمودار:** ذخیره با فرمت‌های `SVG`، `PNG` یا `JPG` در والت.
2. **نمایش/مخفی‌سازی توضیحات (`::`):** سوییچ سریع نمایش یا پنهان کردن یادداشت‌های زیر گره‌ها.
3. **دکمه‌های تنظیمات ظاهری:** تغییر آنی شکل، خطوط، پالت رنگ، جهت و تراز متن برای همان بلوک.
4. **اسلایدر زنده تنظیم عرض:** تغییر حداکثر عرض عنوان اصلی و گره‌ها و مشاهده لحظه‌ای تغییرات در SVG.

---

## کلیدهای میانبر و دستورات

در حین تایپ داخل بلوک‌های `mindmap` و `bracket`:
- **`Enter`:** حفظ خودکار تورفتگی سطر قبلی.
- **`Tab` و `Shift+Tab`:** افزایش و کاهش سطح گره‌های انتخاب‌شده.

از بخش Command Palette (`Ctrl/Cmd + P`):
- `RTL Mindmap: Cycle node shapes`
- `RTL Mindmap: Cycle line styles`
- `RTL Mindmap: Cycle color modes`
- `RTL Mindmap: Toggle direction (RTL/LTR)`


---

## نمونه‌های کاربردی و الگوها

### نمونه ۱: نقشه‌ی ذهنی استاندارد

```mindmap
@shape=rounded
@line=curve
@color=branch
مدیریت پروژه
	فاز اول: برنامه‌ریزی##تعیین اهداف##
		تحلیل نیازمندی‌ها::بررسی دقیق با ذینفعان::
		زمان‌بندی و بودجه@@آماده برای شروع@@
	فاز دوم: اجرا
		طراحی معماری
		پیاده‌سازی کدها
	فاز سوم: کنترل کیفیت
		تست‌های خودکار
		بررسی امنیتی
```


### نمونه ۲: استدلال منطقی و استنتاج چندمرحله‌ای (`bracket`)

```bracket
@bracket=curly
@shape=pill
@align=center
شواهد و فرضیات اولیه
مستندات تاریخی معتبر
	بررسی صحت ادعا
تحلیل آماری جامعه نمونه
	اثبات فرضیه اول
		نتیجه‌گیری نهایی تحقیق##گزارش رسمی##
```

### نمونه ۳: دیاگرام سازمانی بالا‌به‌پایین (`ttb`)

```mindmap
@dir=ttb
@shape=pill
@line=elbow
مدیرعامل
	معاونت فنی
		تیم بک‌اند
		تیم فرانت‌اند
	معاونت مالی
		حسابداری
		منابع انسانی
```

### نمونه ۴: شکست دستی خطوط بدون تغییر ساختار درخت

اگر تمایل دارید متنی طولانی بدون چند قسمتی شدن، در دو خط مجزا قرار بگیرد، کافی است از تگ `<br>` استفاده کنید:

```mindmap
مفهوم بنیادین
	تعریف اول که طولانی است<br>و در دو خط خوانده می‌شود
	تعریف دوم
```


````

---

## شخصی‌سازی پیشرفته با CSS

برای تنظیم اختصاصی رنگ‌ها و فاصله‌ها، می‌توانید یک قطعه کد CSS Snippet در تنظیمات ظاهر ابسیدین فعال کنید:

```css
.mm-container {
  /* تنظیم پالت رنگ شاخه‌ها */
  --mm-c0: #2f80ed;
  --mm-c1: #27ae60;
  --mm-c2: #f2994a;
  --mm-c3: #9b51e0;

  /* تنظیم فاصله‌ها */
  --mm-gap-x: 3.5em; /* فاصله بین سطوح */
  --mm-gap-y: 0.8em; /* فاصله گره‌های هم‌سطح */
}
```