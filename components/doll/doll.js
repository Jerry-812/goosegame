Component({
  properties: {
    dollId: Number,
    type: String,
    label: String,
    image: String,
    size: Number,
    x: Number,
    y: Number,
    z: Number,
    rotate: Number,
    visible: Boolean,
  },
  methods: {
    onTap() {
      if (!this.data.visible) return
      this.triggerEvent('dolltap', { dollId: this.data.dollId })
    },
  },
})

