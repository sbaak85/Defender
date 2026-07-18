/*
 * Defender 遊戲平衡設定檔
 * ------------------------------------------------------------
 * 修改數值後重新整理 index.html 即可生效。
 * 時間單位一律為「秒」，距離與範圍一律以「棋盤格」計算。
 * moveInterval 是移動一格需要的秒數：數字越小，移動越快；0 代表不移動。
 * 音量 volume 範圍為 0～1；files 留空陣列 [] 代表不播放該類音檔。
 *
 * audio.cast   = 單位出招語音／詠唱音（依 chance 機率播放其中一個）
 * audio.attack = 單位發動攻擊時的音檔（隨機播放其中一個）
 * audio.impact = 被該單位命中時的音檔（列出的音檔會一起播放）
 * audio.death  = 單位陣亡時的音檔（隨機播放其中一個）
 */

window.DEFENDER_CONFIG = {
  version: 1,

  game: {
    columns: 6,
    rows: 8,
    initialResources: 10,
    gameSpeeds: [1, 5, 20],
    startingOpenSlots: 6,
    slotUnlockInterval: 40,
    recycleRefundRate: 0.5,
    maxActiveEnemies: 42,
    enemyDamageGrowth: 0.9,
    enemyMoveSpeedVariance: 0.08,
    // Bullet 視覺發射口：8 代表棋盤最靠近城牆的邊線。
    projectileLauncherRow: 8,
    projectileLauncherOffsetX: 0,
    projectileLauncherOffsetY: 0,
    hpBarVisibleSeconds: 3,
    defenderDeathFadeSeconds: 0.5,
    enemyDeathFadeSeconds: 0.5
  },

  scoring: {
    safeDefenseRate: [
      { after: 60, pointsPerSecond: 8 },
      { after: 30, pointsPerSecond: 5 },
      { after: 15, pointsPerSecond: 3 },
      { after: 0, pointsPerSecond: 2 }
    ],
    levelPerformance: {
      1: { clear: 1000, wallPreservation: 1000, clearance: 800, flawless: 500 },
      2: { clear: 1500, wallPreservation: 1500, clearance: 1200, flawless: 800 }
    }
  },

  levels: {
    1: {
      duration: 180,
      spawnStart: 5.05,
      spawnEnd: 0.88,
      openingGoblinOnly: 0.14,
      unlock: { goblin: 0, wolf: 0.12, troll: 0.28, beholder: 0.55, octopus: 0.82 },
      weight: { goblin: 7, wolf: 1.8, troll: 1.25, beholder: 0.28, octopus: 0.12 },
      activeCaps: { beholder: 1, octopus: 1 },
      scaleStart: 1,
      scaleGrowth: 1
    },
    2: {
      duration: 180,
      spawnStart: 5,
      spawnEnd: 0.72,
      openingGoblinOnly: 0.06,
      unlock: { goblin: 0, wolf: 0.04, troll: 0.1, beholder: 0.27, octopus: 0.5 },
      weight: { goblin: 1.1, wolf: 1, troll: 1, beholder: 0.9, octopus: 0.8 },
      activeCaps: {},
      scaleStart: 1,
      scaleGrowth: 1.25
    }
  },

  units: {
    wall: {
      displayName: "城牆",
      faction: "player",
      glyph: "🏰",
      attackDamage: 0,
      attackRange: 0,
      maxHp: 500,
      resourceCost: 0,
      killReward: 0,
      moveInterval: 0,
      footprint: { columns: 6, rows: 1 },
      repairCost: 10,
      repairAmount: 50,
      attackInterval: 0,
      splashDamage: 0,
      splashArea: { columns: 0, rows: 0 },
      unlockLevel: 1,
      scoreValue: 0,
      attackType: "none",
      targetMode: "none",
      canOverlapAtWall: false,
      audio: {
        cast: { chance: 0, files: [] },
        attack: [],
        impact: [],
        death: []
      }
    },

    player: {
      mage: {
        displayName: "法師",
        faction: "player",
        glyph: "🧙",
        attackDamage: 10,
        attackRange: 8,
        maxHp: 90,
        resourceCost: 4,
        killReward: 0,
        moveInterval: 0,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 2,
        splashDamage: 0,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 1,
        scoreValue: 0,
        attackType: "fireball",
        targetMode: "same-column-nearest-wall",
        canOverlapAtWall: false,
        audio: {
          cast: {
            chance: 0.3,
            files: [
              { path: "assets/audio/魔法師/「スキあり！」.mp3", volume: 1 },
              { path: "assets/audio/魔法師/「たあっ！」.mp3", volume: 1 }
            ]
          },
          attack: [{ path: "assets/audio/音效/damage1.mp3", volume: 0.6 }],
          impact: [{ path: "assets/audio/音效/bomb.mp3", volume: 0.6 }],
          death: []
        }
      },

      archer: {
        displayName: "弓箭手",
        faction: "player",
        glyph: "🏹",
        attackDamage: 7,
        attackRange: 10,
        maxHp: 85,
        resourceCost: 3,
        killReward: 0,
        moveInterval: 0,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 1,
        splashDamage: 0,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 1,
        scoreValue: 0,
        attackType: "arrow",
        targetMode: "same-column-nearest-wall",
        canOverlapAtWall: false,
        audio: {
          cast: {
            chance: 0.2,
            files: [
              { path: "assets/audio/弓箭手/「たあ！」.mp3", volume: 1 },
              { path: "assets/audio/弓箭手/「そこ！」.mp3", volume: 1 }
            ]
          },
          attack: [{ path: "assets/audio/音效/stabbing.mp3", volume: 0.6 }],
          impact: [{ path: "assets/audio/音效/hitting1.mp3", volume: 1 }],
          death: []
        }
      },

      warrior: {
        displayName: "戰士",
        faction: "player",
        glyph: "🛡️",
        attackDamage: 20,
        attackRange: 3,
        maxHp: 165,
        resourceCost: 3,
        killReward: 0,
        moveInterval: 0,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 3,
        splashDamage: 20,
        splashArea: { columns: 3, rows: 3 },
        unlockLevel: 1,
        scoreValue: 0,
        attackType: "slash",
        targetMode: "area-nearest-wall",
        canOverlapAtWall: false,
        audio: {
          cast: {
            chance: 0.4,
            files: [
              { path: "assets/audio/戰士/「くらえ！」.mp3", volume: 1 },
              { path: "assets/audio/戰士/「二段斬りだ！」.mp3", volume: 1 }
            ]
          },
          attack: [
            { path: "assets/audio/音效/swing1.mp3", volume: 1 },
            { path: "assets/audio/音效/swing2.mp3", volume: 1 }
          ],
          impact: [
            { path: "assets/audio/音效/cutting_with_a_katana1.mp3", volume: 1 },
            { path: "assets/audio/音效/katana1.mp3", volume: 1 }
          ],
          death: []
        }
      },

      ballista: {
        displayName: "弩砲塔",
        faction: "player",
        glyph: "⚙️",
        attackDamage: 2,
        attackRange: 5,
        maxHp: 145,
        resourceCost: 8,
        killReward: 0,
        moveInterval: 0,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 0.3,
        splashDamage: 0,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 2,
        scoreValue: 0,
        attackType: "bolt",
        targetMode: "same-column-nearest-wall",
        canOverlapAtWall: false,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      },

      cannon: {
        displayName: "加農砲塔",
        faction: "player",
        glyph: "💣",
        attackDamage: 100,
        attackRange: 9,
        maxHp: 190,
        resourceCost: 10,
        killReward: 0,
        moveInterval: 0,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 5,
        splashDamage: 100,
        splashArea: { columns: 3, rows: 3 },
        unlockLevel: 3,
        scoreValue: 0,
        attackType: "shell",
        targetMode: "area-nearest-wall",
        canOverlapAtWall: false,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      }
    },

    enemy: {
      goblin: {
        displayName: "哥布林",
        faction: "enemy",
        glyph: "👺",
        attackDamage: 2,
        attackRange: 1,
        maxHp: 30,
        resourceCost: 0,
        killReward: 1,
        moveInterval: 1.43,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 2,
        splashDamage: 1,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 1,
        scoreValue: 100,
        attackType: "melee",
        targetMode: "wall-and-same-column-defender",
        canOverlapAtWall: true,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      },

      troll: {
        displayName: "巨魔",
        faction: "enemy",
        glyph: "👹",
        attackDamage: 4,
        attackRange: 1,
        maxHp: 50,
        resourceCost: 0,
        killReward: 2,
        moveInterval: 4.29,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 4,
        splashDamage: 3,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 1,
        scoreValue: 220,
        attackType: "melee",
        targetMode: "wall-and-same-column-defender",
        canOverlapAtWall: true,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      },

      beholder: {
        displayName: "眼魔",
        faction: "enemy",
        glyph: "👁️",
        attackDamage: 6,
        attackRange: 1,
        maxHp: 70,
        resourceCost: 0,
        killReward: 3,
        moveInterval: 3.14,
        footprint: { columns: 2, rows: 2 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 4,
        splashDamage: 5,
        splashArea: { columns: 2, rows: 1 },
        unlockLevel: 1,
        scoreValue: 550,
        attackType: "magic",
        targetMode: "wall-and-covered-column-defenders",
        canOverlapAtWall: true,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      },

      wolf: {
        displayName: "狼",
        faction: "enemy",
        glyph: "🐺",
        attackDamage: 5,
        attackRange: 1,
        maxHp: 60,
        resourceCost: 0,
        killReward: 2,
        moveInterval: 1.93,
        footprint: { columns: 1, rows: 1 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 3,
        splashDamage: 4,
        splashArea: { columns: 1, rows: 1 },
        unlockLevel: 1,
        scoreValue: 280,
        attackType: "melee",
        targetMode: "wall-and-same-column-defender",
        canOverlapAtWall: true,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      },

      octopus: {
        displayName: "章魚怪",
        faction: "enemy",
        glyph: "🐙",
        attackDamage: 10,
        attackRange: 1,
        maxHp: 120,
        resourceCost: 0,
        killReward: 8,
        moveInterval: 3.86,
        footprint: { columns: 2, rows: 2 },
        repairCost: 0,
        repairAmount: 0,
        attackInterval: 5,
        splashDamage: 8,
        splashArea: { columns: 2, rows: 1 },
        unlockLevel: 1,
        scoreValue: 900,
        attackType: "melee",
        targetMode: "wall-and-covered-column-defenders",
        canOverlapAtWall: true,
        audio: {
          cast: { chance: 0, files: [] },
          attack: [],
          impact: [],
          death: []
        }
      }
    }
  }
};
