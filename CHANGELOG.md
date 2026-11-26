# Changelog

## v1.6.2

- Skin the native checkboxes and radios. Both are painted by the browser — on Windows a checked box is a solid `#0078D4` square and a radio a blue dot, neither of which knows about the glass — and they sit inside the plugin panels that draw their own chrome. `appearance: none` hands the box over to the sheet: an inset well on the panel, the action fill when checked, a tick drawn with a mask so it takes the inverted ink rather than a hard-coded white, and a matching circle for radios. The size and margin carry `!important` because several plugins set them inline, and inline wins over any selector.
- Turn the diff preview that opens over the transcript into glass. Hovering a file row in the "edited N files" card opens the host's `HoverCard` in its preview variant: a one-file comparison, `position: fixed`, sized from the card. It painted itself with `--dsw-alias-bg-layer-1` — flat `#FFFFFF` in float mode — over rows tinted `#e6f4e7` / `#fce6e2`, so it landed as a solid white plate with pastel stripes. The plate now carries the secondary-glass recipe and clears that token, and the row tints stay at a quarter of their density: a green/red pair is what makes a comparison readable, so a neutral row would remove the information rather than the slab. Keyed off `data-changes-hover-preview`, the deliverables component's own attribute.
- Skin the generic hover card. The same primitive in its compact and media variants paints `--dsw-alias-hovercard-bg`, which the host points at a solid near-black in both schemes, so every timestamp, file-name and picture preview was an opaque dark plate. The hook is the inline `--dsh-hover-preview-fade` the primitive writes on every variant — its own class name is just `card`, which a substring would match half the page with. That rule is placed before the diff preview's, because both match the preview element at the same specificity.
- Turn a code block in the transcript into a pane of the glass. The renderer stacks three opaque fills on it: the block itself paints `--dsw-alias-markdown-code-block` (`#F0F5FB` light / `#0D141F` dark), its `<pre>` repeats that fill, and the shiki `<code>` carries the same token again as an inline `background`; the banner wrap on top adds `--dsw-alias-bg-base`, the canvas colour. Together that was a solid pale slab in the middle of the conversation. The block now clears both tokens in its own scope and carries the secondary-glass recipe — translucent fill, a top highline, a hairline, a 16px corner and a light blur — while the shiki layer gives up its inline paint with `!important`, which is the only thing that reaches an inline style. The banner stays one notch brighter than the body so the copy row still separates.
- Let a third-party pane inside the workbench card show the glass. `dsh-github-flow` paints its root with `background: var(--dsw-alias-bg-base)` — the canvas colour, which this skin resolves to an opaque `#F4F8FD` and `#0C121B` — so the whole tab landed as one plate filling the card, with its own white cards stacked on top of that. Nothing in that plugin is hard-coded; it consumes our tokens, and the token is simply opaque. The workbench pane scope now clears it and turns the four surface layers translucent, which fixes every pane mounted there and every future plugin that reaches for the canvas colour to mean "paint the page". Ink and hairlines keep their own tokens.
- Turn the terminal pane into an inset screen instead of a sheet of paper. Its screen is painted `background: var(--dsw-alias-bg-base)` — the canvas colour, which this theme resolves to an opaque `#F4F8FD` in light and `#0C121B` in dark. Full-bleed, that was the one surface in the column that never showed the water. The screen now takes an opaque tint one step deeper than the card, with a 14px corner, a top highline and a hairline, so it reads as a display set into the glass. It has to stay opaque: the pane feeds xterm its theme background from the screen's computed colour, and the host builds xterm with the default `allowTransparency: false` — under that option a translucent colour composites onto black, so a `color-mix` fill turned the whole terminal into a black rectangle. xterm also writes the resolved value onto `.xterm-viewport` as an inline style, so that layer gives up its paint with `!important`. Both `xterm` class names arrive through `:global()`, because the CSS-module transform rewrites every bare class selector in this file into `<hash>_<local>` and a rewritten `.xterm` matches nothing.
- Turn the guide tab — the start page inside the right column — into glass. Its capsules are painted `background: var(--dsw-alias-bg-layer-1)`, which in float mode is an opaque `#FFFFFF`, so six white cards were stacked on a glass pane; they now take the secondary-glass recipe (translucent fill, top highline, hairline, a lift under the pointer). Its compass reads `--dsw-specific-guide-hero`, which the host points at `--dsw-static-neutral-200` — a watermark tuned for a solid sheet, invisible on pale glass; it now draws on the pane's own ink at a watermark alpha.
- Make the pinned header inside an expanded "think" row a pane of the glass. The host keeps the collapse toggle reachable while the reasoning body scrolls, so it pins the disclosure header and paints it with `background: var(--dsw-alias-bg-base)` — the canvas colour, which this skin resolves to an opaque `#F4F8FD`. Over a pane that landed as a paper strip with the card's rounded edge cut across it. The band now takes the card material at twice the blur, so reasoning text sliding underneath stops being legible.

## v1.6.1

- Let the environment card's glass reach its own right edge. The host reserves a lane for its scrollbar with `border-right: 2px solid transparent` and `padding-right: calc(8px - 2px - scrollbar-width)` under `scrollbar-gutter: stable`; an `inset` ring is painted against the padding box, so that transparent border left a bare column down the right side. The border is gone and the same 2px sits in the padding now, so the ring lands where the eye expects and the scrollbar keeps its lane.
- Make the glow overlay fill the pane it belongs to. It is `position: absolute; inset: 0`, so it resolves against the padding box, but it was sized from `clientWidth`/`clientHeight` — which exclude both the border and a reserved scrollbar gutter. On the environment card that left the glow short down the right side. The overlay now measures the padding box (border box minus border widths), so it covers the lane as well.
- Keep a hover tooltip readable. The tooltip's own class is `hxWHXa_bubble`, so the chat-bubble rule matched it and gave the tip a 42% white fill, while its label keeps the host's `--dsw-alias-tooltip-label` — white in both schemes. White on white left every tooltip blank. The bubble recipe now excludes `[role='tooltip']`, and the tip keeps its own dark surface with the frost family's shadow.
- Give a checked switch a track its thumb can be seen against. The host paints the track with the brand colour, which this skin sets to the brand ink, so a white thumb on a near-white track vanished in dark mode. The track now uses the button fill.
- Release the pressed pane and its lifted titlebar buttons in the same frame, and key those buttons per pane rather than per session. The settle timer used to drop the inline transform while the transition was still running, which left a computed transform on the card for another 300ms; a button restored inside that window was re-anchored to the card's corner and flashed. A fast in-and-out could also leave a button behind a transform it never left.
- Stop the pane rule from re-positioning a dialog. The stats popover is `role='dialog'` with `position: fixed` and CSS anchor positioning, so the generic pane rule's `position: relative` dropped it out of its anchor and it laid out at the end of the document instead of under its pill.

## v1.6.0

- Let the sidebar card tilt with the others. Its two `position: fixed` titlebar buttons are lifted to `<body>` for the duration of a press, so they keep resolving against the viewport while the card rotates, and are put back at their original slot afterwards.
- Skin the shared segmented tabs. Both host implementations are covered — the plugin manager's installed / marketplace pair and the model page's provider switch — with one neutral track, a hairline and a light blur, plus a sliding indicator that reads as a raised pane. A plain `role='tablist'` row of buttons is excluded by requiring the sliding child.
- Soften the second-level surface in one place. `--dsw-alias-bg-module-platform` is the host's second-level glass across 85 rules in 46 files; it is translucent now, and `--dsw-specific-menu` follows, so popovers, the queue dock, the todo panel, the goal bar and the forge change rows stop being white slabs.
- Bring the edited-files card into the glass, including its header band and icon tile, both re-pointed in the card's own scope.
- Give a main-area panel the glow and the press instead of the toolbar inside it. The header seam no longer matches a panel's own `<header>`, and the panel page root is stamped in its own right.
- Make the scrollbars a pane of the glass: neutral ink instead of the brand blue, a specular sweep down the thumb, and a groove that only appears under the pointer. The lane width stays the host's 5px because other surfaces derive their padding from it.
- Give the panels inside a sheet their own layer of glass. Re-pointing the tokens made them translucent, but a translucent wash is not glass: they now carry a blur, a top highline and a hairline, and a card that answers the pointer lifts on hover.
- Cut the settings sheet's contents from its own material. The rows inside it paint solid surface tokens — a selected nav row uses `--dsw-alias-bg-layer-1`, a segmented control sits on `--dsw-alias-bg-module-platform`, an input on `--dsw-alias-bg-layer-3` — and in float mode those resolve to flat hex values, so every row landed as an opaque plate on top of the glass. The sheet now re-points those five tokens to `color-mix` values scaled by the frost knob in its own scope. Ink and hairlines keep their own tokens.
- Turn the workbench's active tab chip into glass. The tab strip sits inside the frosted card, but the active chip was a flat opaque slab — the kit paints it with `background: var(--dsw-alias-markdown-tag)`, which resolves to `rgb(241, 243, 245)` in light mode and the bluish-850 neutral in dark, so it read as a grey sticker on top of the glass. The chip now takes the card's own recipe through `color-mix` and the frost knob, draws its own hairline, and frosts what is behind it. Keyed off `role='tab'`, `aria-selected` and the stable `data-dockkit-strip` attribute, so a module rename cannot strand it.
- Give the settings sheet and the image viewer the same glow and press as the cards. Both are `role='dialog'` portals on `<body>` and were already glass, but neither was stamped as a spotlight pane, so the effects stopped at their edge. The dialog's glass moves onto `::before` so the z-index -1 glow can show through it. The viewer's backdrop is excluded from every fill and blur rule: it is the full-viewport dim, and painting the sheet fill on it washed the whole window. The picture inside it is stamped instead, and a replaced element is skipped by the glow overlay because an `<img>` renders no children.
- Two dialog shapes stay still: one that covers the viewport, and one that opens its own `position: fixed` menu (a live transform would re-anchor that menu).
- Skin native `<select>` dropdowns. The popup is drawn by the browser outside the page's own layers, so no rule could reach it and opening a route picker dropped a solid white sheet with square corners onto the glass. `appearance: base-select` now renders the picker in the page, which exposes `::picker(select)`, `option` and `::checkmark` to the same frosted recipe as the other floating surfaces. Guarded by `@supports`, so a browser without customizable selects keeps the stock control.
- Give the picker and every other plugin's popup the same press as the panes. The picker rises from 0.96 on open and its highlighted row sinks a hair; `role='menu'` command lists, `role='listbox'` model pickers and popper cards tighten their shadow under the pointer. All of it rides the panes' 300ms clock and the one press switch.

## v1.5.1

- Add the right workbench card to the spotlight panes: the cursor glow and the hover press now reach it, matching the sidebar, the header and the composer. The card had a glass surface but was never stamped with the `data-dsh-aqua-spot` seam the two effects key off, so it stayed inert while every other pane answered the pointer.
- The card stands still while a dockkit pane is torn out of it: that pane is `position: fixed` and lives inside the card, so a live transform would re-anchor it, the same reason the sidebar never tilts.
- Move the workbench glass onto `::before`, like the sidebar and the composer. A `backdrop-filter` on the card made it the backdrop root of its own contents and the containing block of the floated pane.
- Inset the workbench card 12px on all four sides (it had 8px top and no left margin), and inset the docked pane 10/12px inside it. The pane is an absolutely positioned canvas pinned to the column track with an inline pixel width, so its tab strip and scroll body sat flush against the glass edge while the sidebar and header kept their padding.
- Drop the kit's `border-left` on the first docked column. It separates columns in the stock layout; inside the inset card there is nothing to its left but the card border, so the hairline landed inside the glass and read as an extra column.
- Stop the composer hover press from shoving the transcript column upward. The press scales its pane by 1.01, and the composer slab is as wide as the content column, so its right edge painted ~5px past the transcript scrollport. A transform counts toward the scrollable overflow region, so the stock `overflow-y: auto` grew a horizontal scrollbar; the bar took ~5px off `clientHeight`, and since the slab is laid against the container's bottom edge the whole column jumped up 5px in a single frame. That is a layout change, which no CSS transition can interpolate. The scrollport now sets `overflow-x: clip`, so the axis cannot scroll and the height never changes. The press itself is untouched: scale, rotation, glow and the recess all stay.
- Soften the hover press: the transform transition runs 300ms on a symmetric `cubic-bezier(0.4, 0, 0.2, 1)` instead of 100ms `ease-out`, so the press-in and the eased return both settle. `SETTLE_MS` moves to 360ms so the inline transform is not dropped mid-flight.

## v1.5.0

- Adapt to DSH 0.2.2-rc.1: require `>=0.2.2-rc.1 <0.3.0-0`, move Cordis to 4.1.0, and build against the 0.2.2-rc.1 client packages.
- Register the Glass theme row at order 11.5 so the redesigned General section shows it directly under Font size and above the transcript-view rows; match the host's 16px row rhythm, 0.5px hairline, and right-aligned master switch.
- Give DSH 0.2.2's new right workbench (`[data-rightbar-col]`) the same floating glass card as the sidebar; the old `detailsCol` seam never matched stock DSH.
- Fix the scheme delete button color: `--dsw-alias-label-error` does not exist in the host themes, so use `--dsw-alias-state-error-primary`.
- Rename the project and package to Driftglass (`dsh-driftglass`); the loader id, activation patch id, invariant strings, tests, installer, and READMEs follow, while the internal Aqua storage keys, document attributes, and CSS module names stay for compatibility with existing settings.
- Widen `engines.dsh` from a single tested release to a SemVer range per the packaging guide, so later 0.2.x releases and 0.3.0 stay installable; the manifest test now probes the range anchor-by-anchor and rejects 0.3.0 prereleases under naive SemVer implementations too.
- Track `main` in the GitHub install reference so the renamed package installs from the repository; the READMEs explain how to pin a tag or commit when a frozen build is preferred.
- Lock the client bundle's externalized-module surface with a manifest test: the built factory may ask the page loader only for `react`, `react/jsx-runtime`, and `@deepseek-ai/dsh-client-store` (the exact set official entries rely on); a guard also freezes the four reviewed inject edges so a non-entry package can never join the graph.
- Set the whole UI in a serif CJK face: body copy, headings, the conversation tree, settings and markdown code blocks now share one CJK serif stack (Noto Serif SC, then Songti SC/STSong, SimSun); Latin/digits keep Space Grotesk and code blocks keep the host monospace.
- Improve checked switch contrast: use the theme's blue action color for the track so the white thumb stays visible in dark and light appearances.
- Match the plugin manager page to the scheduled tasks page: the plugins panel now floats as the same frosted card (20px corners, hairline border, soft shadow, backdrop blur) while keeping its own scroll container and a stable scrollbar gutter. Its title rows also sit directly on that card instead of picking up the session-header card as a second, detached bar — the flatten rule now matches the real markup (`pageBody > sticky pageBar > header`, not a header directly under the section), and DSH's sticky title band stays clear at the top instead of painting an opaque canvas-colored strip inside the card; once rows slide underneath, the band frosts with the card material at twice the card blur.
- Keep the Windows titlebar chrome on screen: the sidebar's glass moved onto a pseudo-element — a `backdrop-filter` on the column made it the containing block of the titlebar's fixed controls, so the collapse/expand toggle rendered inside the card and then vanished, clipped away once the column collapsed to a 0px track.
- Stop the hover tilt on the sidebar column so its fixed guests (the titlebar controls and the settings overlay) always anchor to the window; the cursor glow still applies.
- Separate light and dark wallpapers: each scheme keeps its own wallpaper (image or video) with its own blur/frost/brightness knobs, and switching Appearance swaps the backdrop live; a scheme without a wallpaper falls back to the fluid board, and the existing wallpaper is seeded into both schemes once, so nothing changes visually until you set them apart.
- Cursor glow: white specular highlight instead of the hue-tinted cyan; the 色调/hue slider now recolors the fluid water only.
- Rewrite the README in English and Chinese around the current fork: custom diagrams for the two modes, the three floating panels, and the per-scheme wallpaper studio, plus fresh WebP screenshots.

## v1.4.2

- Clamp restored color-depth values to the supported range.
- Keep Windows transcript text below the floating header and title bar.
- Synchronize controls, numeric settings, and mesh effects between windows.
- Allow choosing a different video when the previous file is already authorized.
- Ignore video wallpaper loads that finish after the theme or background has changed.
- Restore video wallpaper playback after switching to the fluid background and back.
- Preserve the video format when wallpaper storage falls back to a data URL.
- Fall back to the standard video file picker if the native picker is unavailable, while respecting cancellation.
- Restore the fluid background after the selected wallpaper is deleted.

## v1.4.1

- Fix the opaque desktop center column hiding the fluid or wallpaper backdrop on DSH 0.2.1-rc.5; add regression coverage for Windows and macOS layouts.

## v1.4.0

- Adapt the theme and its settings controls to DSH 0.2.1-rc.5; keep the master switch in General settings after the old plugin-card slot was removed.
- Give the GitHub installation its own package identity and include its activation patch.
- Replace the obsolete machine-specific build and install scripts; retire the publisher that targeted the original npm package.
- Make the standalone client build reproducible across clean checkouts.
- Add regression coverage for DSH 0.2.1-rc.5 installation and the theme switch.

## v1.3.0

- 视频壁纸全面升级：浏览器原生解码、无进度条、循环播放、铺满裁剪，窗口缩放实时自适应
- 视频壁纸「记住文件授权」：选一次即可（File System Access，刷新自动读取原文件、改动即时生效、不占额外存储；非 Chromium 自动退回数据库存储）
- 视频壁纸自动柔光罩 + 聊天气泡实底，保证文字在视频上清晰可读
- 视频壁纸新增「模糊度」「亮度」两个滑杆（含提醒文案）
- 发送栏与数据栏共用一块玻璃：单一背景/模糊/边框/投影，分界线精确落在左右圆角弯曲处，两片玻璃不再出现模糊度/清晰度不一致
- 数据栏文字、发送栏占位符改中性色（深色模式近白、浅色模式深灰），去除蓝色调
- 玻璃卡片平板化：去掉卡片底部黑色渐变，视觉更干净

## v1.2.1

- 鼠标辉光颜色跟随「色调」设置（与流体晕染色共用色相基准），不再默认泛蓝

## v1.2.0

- 新增「悬停下压」：官网卡片同款 3D 倾斜（哪边鼠标哪边下压、透视 800px + 微放大 1.01、0.1s 过渡），顶栏/侧边栏/发送框+数据栏/轨迹窗统一配方，轨迹窗幅度减半，设置里可开关
- 新增「鼠标辉光」：跟随光标的荧光青光晕，位于玻璃之下从磨砂中透出，不遮内容
- 设置页玻璃化：50px 磨砂、深浅色区分、兼容模式生效；打开设置即时弹出不再卡顿
- 设置分组优化：环境装饰（粒子鲸鱼/小鱼/网状交互）与悬停效果（鼠标辉光/悬停下压）分组，子标题放大加粗
- 背景新增「色调」「颜色深浅」双滑条：全程无极调节；0°/360° 锚定蓝色、默认 320° 青蓝；深浅 0 端直落纯黑（深色）/深浓原色（浅色），100 端浅淡粉彩
- 兼容模式修复：注入层不再顶歪顶栏/新建会话按钮/发送栏
- 浅色模式聊天文字微投影 + 1px 光晕
- 出厂默认：模糊 20 / 磨砂 7 / 色调 320 / 深浅 25 / 亮度 50，全部开关默认开启

## v1.1.2

- 新增「小鱼」开关（背景游动的小鱼/气泡，位于粒子鲸鱼开关右侧）
- 壁纸新增「删除」按钮（清除已选壁纸）

## v1.1.1

- 侧边栏收起状态悬浮玻璃，收起带渐隐动画
- 页面顶部/底部渐变模糊带（浅色泛白、深色泛黑）
- 漂浮玻璃投影加深
- 新建会话按钮透明玻璃，磨砂度跟随磨砂旋钮 +20
- 统计行与发送框分界线更清晰
- 设置页不再被顶栏遮挡；展开时 Harness 铭牌实时就位
- 设置文案简化

## v1.1.0

- 新增「粒子鲸鱼」：deepseek.com/harness 同款（官网粒子引擎 2D 移植），显示在聊天主区域正中央（不含侧边栏），深色模式白粒子、浅色模式灰粒子，设置里有开关可关
- 深色模式侧边栏铭牌换成官网同款「Harness」光泽药丸（135° 渐变描边 + 柔光 + 黑底白字），浅色模式保持原版铭牌
- 页面顶部/底部新增 5px 渐变模糊带，悬浮在聊天内容上层，内容滚到边缘渐入模糊；浅色模式微泛白、深色模式微泛黑
- 「漂浮玻璃」更名「云母效果」

## v1.0.8

- 通用设置里的玻璃主题控件去掉独立标题，直接跟在「外观」下方；插件页总开关关闭时，通用设置里的整块调节自动隐藏，打开开关即恢复
- 「选择图片」旁新增提示：浅色壁纸用浅色模式，深色壁纸用深色模式⚠️
- 设置排版统一：壁纸行改为「标签 + 控件」结构，模式/亮度/壁纸三条说明文字全部与所解释的控件列对齐

## v1.0.7

- 背景亮度自动跟随深浅模式：**深色模式只能在 0–50 调节**（压暗，50 原样），**浅色模式只能在 50–100 调节**（提亮，50 原样）；「跟随系统」按实际解析出的深浅色自动切换，旋钮范围与提示文字实时翻转，另一侧的旧值自动失效不干扰

## v1.0.6

- 设置重新布局：总开关留在「插件」页（卡片形状与其他插件一致），其余全部调节（模式/模糊度/磨砂度/流体颜色/背景亮度/背景/壁纸）移到**通用设置 → 外观**的正下方；主题未开启时该行会变暗并提示开关位置

## v1.0.5

- 修复「背景亮度」0–50 无效的问题：黑色遮罩原来画在流体/壁纸**下面**被盖住，现与白色遮罩合并到同一顶层（`::after`），0 = 死黑、100 = 死白、50 = 透明全部生效

## v1.0.4

- 新增「背景亮度」调节（0 = 纯黑、50 = 透明、100 = 纯白），漂浮/兼容两种模式都可用

## v1.0.3

- 安装器改为**优先 zip 下载**（普通 HTTP 更快更稳），git clone 只作后备——git 连 GitHub 不稳时不再白等十几秒

## v1.0.2

- 安装脚本默认安装**最新发布版**（通过 GitHub API 解析，可 `-Version 'v1.0.1'` 指定版本或 `-Version 'main'` 跟随开发分支）
- 修复安装脚本在 Windows PowerShell 下中文提示乱码（UTF-8 BOM）

## v1.0.1

- 兼容模式新增「背景流体颜色」调节入口（颜色旋钮在两种模式下都可用）
- 介绍补充兼容模式（双模式）说明

## v1.0.0

首个正式版本：可开关的玻璃主题，双模式 + 高自由度自定义。

- **漂浮玻璃模式**：顶栏、侧边栏、发送框、统计行、轨迹视图变成悬浮玻璃卡片，聊天区在流体上滑动
- **兼容模式**：保持原版排版一字不动，只把材质换成通用玻璃——按角色和类名子串命中菜单/卡片/气泡/下拉/提示等保守表面，其他插件的界面同样自动玻璃化
- **可调旋钮**（无极滑块 + 数值框）：玻璃模糊度、磨砂度、背景流体颜色
- **背景**：流体板或自定义壁纸（铺满页面、比例不变），壁纸单独可调模糊度/磨砂度，图片自动压缩后本地保存
- 深色玻璃改中性冷灰，磨砂度拉满不再泛蓝；发送栏正确模糊背后的内容
- 问候语等文案功能独立，不在本主题内
- 一键安装 `install.ps1`（按版本号安装，无 git 时自动退回 zip 下载）
