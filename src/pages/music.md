---
layout: ../layouts/PageLayout.astro
title: "歌单"
description: "我喜欢的音乐"
---

这里是你喜欢的音乐歌单。

你可以使用 `{% media audio %}` 标签来嵌入 YouTube 音乐歌单：

```markdown
{% media audio %}
- title: My Heavy Metal Mix
  list:
    - name: For Whom The Bell Tolls
      artist: Metallica
      youtubeId: B_HSa1dEL9s
{% endmedia %}
```

{% media audio %}
- title: Heavy Metal Mix
  list:
    - name: "For Whom The Bell Tolls"
      artist: "Metallica"
      youtubeId: "B_HSa1dEL9s"
    - name: "Dance of Death"
      artist: "Iron Maiden"
      youtubeId: "3659fTXvFts"
    - name: "Fade to Black"
      artist: "Metallica"
      youtubeId: "9HZ_tx8aWuA"
{% endmedia %}
