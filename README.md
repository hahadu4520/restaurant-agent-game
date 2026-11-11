# 我的餐厅

一个 Three.js 餐厅经营小游戏。为餐厅和店长起名，探索五个工作站，试做菜谱，然后开始两分钟营业挑战。每局成绩、餐厅名和游戏进度都保存在当前浏览器。

## 开始游玩

下载并解压仓库后，双击打开 `index.html`。`three.min.js` 已包含在仓库中，与网页放在同一目录即可离线游玩。

- 点击地面，或用方向键和 WASD 移动。
- 走近工作站后点击标签，或按 E 操作。
- 打开右上角的排行榜可查看每局成绩。

## 修改源码

- `src/shell.html` 是网页结构和样式。
- `src/scene.js` 是 3D 场景、角色和移动逻辑。
- `src/game.js` 是教程、菜谱、营业和排行榜逻辑。

修改后在仓库根目录运行 `python build.py`，再打开生成的 `index.html`。构建只用 Python 3.10 及以上版本的标准库。

Three.js r159 的 MIT 许可证见 [THREE-LICENSE.txt](THREE-LICENSE.txt)。
