<template lang="pug">
  div.grid-container(:class="{hidemenu: menuToggle}")
    sl-vue-tree(
      v-model="nodes"
      id="filesTree"
      isDraggable="false"
      @nodeclick="onFileClick"
    )
      template(slot="title" slot-scope="{ node }")
        span.item-icon
          i(v-if="node.isLeaf").fa.fa-file
          i(v-else).fa.fa-folder
          | &nbsp;{{ node.title }}
      template(slot="toggle" slot-scope="{ node }")
        span(v-if="!node.isLeaf")
          i(v-if="node.isExpanded").fa.fa-chevron-down
          i(v-else).fa.fa-chevron-right
      template(slot="draginfo")
    codemirror(
      ref="mycm"
      id="editor"
      v-model="text"
      :options="cmOptions"
      @changes="editorOnChanges"
    )
    div.statusbar
      div#menuToggle
        input(type="checkbox" v-model="menuToggle")
        span
        span
        span
      div.element
        select(@change="onModeChange($event)" v-model="mode")
          option(
            v-for="m in modes" 
            selected="m == mode"
            :value="m"
          )
            | {{m}}
</template>

<script>
  import slVueTree from 'sl-vue-tree'
  import { codemirror } from 'vue-codemirror'
  import 'codemirror/lib/codemirror.css'
  import 'codemirror/addon/search/search.js'
  import 'codemirror/addon/search/jump-to-line.js'
  import 'codemirror/addon/search/searchcursor.js'
  import 'codemirror/addon/dialog/dialog.js'
  import 'codemirror/theme/monokai.css'
  import 'codemirror/addon/dialog/dialog.css'

  import { detect, languages } from 'program-language-detector'
  import _debounce from 'lodash-es/debounce'
  import { setTimeout } from 'timers';

  function filesTree(root, files) {
    if (files.length==0) {
      return
    }
    else {
      let file = files.shift()
      root[file] = root[file] || {}
      filesTree(root[file], files)
    }
  }

  function filesTree2List(tree) {
    let files = Object.keys(tree)
    let ret = []
    for (let file of files) {
      if (Object.keys(tree[file]).length===0) {
        ret.push({title: file, isLeaf: true, isDraggable: false})
      }
      else {
        let children = []
        for (let x of Object.keys(tree[file])) {
          if (Object.keys(tree[file][x]).length===0) {
            children.push({title: x, isLeaf: true, isDraggable: false})
          }
          else {
            children.push({title: x, isLeaf: false, isDraggable: false, children: filesTree2List(tree[file][x])})
          }
        }
        ret.push({title: file, isLeaf: false, isDraggable: false, children: children, data: {'teste': 'lol'}})
      }
    }
    return ret
  }

  function getPath(nodes, pos) {
    let path = ""
    for (let p of pos) {
      if (nodes.constructor === Array) {
        nodes = nodes[p]
      }
      else if (!nodes.isLeaf) {
        nodes = nodes.children[p]
      }
      path += nodes.title+'/'
    }
    return path.substring(0, path.length-1)
  }

  export default {
    props: {
      msg: String
    },
    components: {
      codemirror,
      slVueTree
    },
    created() {

    },
    computed: {
      codemirror() {
        return this.$refs.mycm.codemirror
      },
      room() {
        if (!this._id || !this.joined) {
          return null
        }
        return this.roomName
      },
      roomName() {
        return window.location.pathname.replace(/\/$/,'').slice(1)
      }
    },
    data () {
      return {
        menuToggle: true,
        nodes: [],
        editor: null,
        joined: false,
        _id: null,
        text: '',
        mode: '',
        modes: [
          'clojure', 'cmake', 'css', 'django', 'dockerfile', 'go', 'html', 'javascript', 'jsx', 
          'julia', 'lua', 'markdown', 'nginx', 'octave', 'pascal', 'perl', 'php', 'powershell',
          'pug', 'python', 'r', 'ruby', 'rust', 'sass', 'shell', 'sparql', 'sql', 'stylus', 'swift', 
          'vb', 'vbscript', 'vue', 'xml', 'yaml'
        ],
        cmOptions: {
          tabSize: 4,
          styleActiveLine: false,
          lineNumbers: true,
          styleSelectedText: false,
          line: true,
          showCursorWhenSelecting: true,
          theme: 'monokai',
          lineWrapping: true
        }
      }
    },
    mounted() {
      this.setMode(this.mode)
    },
    sockets: {
      connect() {
        this._id = this.$socket.id
        this.$socket.emit('room', this.roomName)
      },
      disconnect() {
        console.log('Disconnected from ' + this.room)
        this._id = null
        this.joined = null
      },
      room(status) {
        if (status === 'joined') {
          this.joined = true
          console.log('Connected to ' + this.room)
        }
      },
      filesList(files) {
        let root = {}
        for (let file of files) {
          filesTree(root, file.split('/'))
        }

        this.nodes = filesTree2List(root)
      },
      updateRoomData(roomData) {
        this.ignoreChange = true
        if (roomData._id !== this._id && this.joined) {
          if (roomData.text!==undefined) {
            this.text = roomData.text
          }
          if (roomData.mode!==undefined) {
            if (this.mode !== roomData.mode) {
              this.mode = roomData.mode
              this.setMode(this.mode)
            }
          }
        }
        this.ignoreChange = false
      }
    },
    methods: {
      editorOnChanges(instance, changes) {
        for (let change of changes) {
          if (change.origin !== 'setValue') {
            return this.editorOnChange(this.text)
          }
        }
      },
      setMode(mode) {
        mode = mode.replace('html','htmlmixed')
        import(`codemirror/mode/${mode}/${mode}.js`).then(()=>{
          this.codemirror.setOption('mode', mode)
          if (this.mode!=='') {
            this.$socket.emit('updateRoomData', {
              mode: this.mode,
              '_id': this._id
            })
          }
        })
      },
      onModeChange(event) {
        var mode = event.target.value.toLowerCase()
        this.setMode(mode)
      },
      editorOnChange(text) {
        if (this.joined && !this.ignoreChange) {
          this.ignoreChange = true
          this.$socket.emit('updateRoomData', {
            text: this.text,
            '_id': this._id
          })
          this.ignoreChange = false
        }
      },
      onFileClick(ev) {
        let path = getPath(this.nodes, ev.path)
        if (path!==this.room) {
          window.location = '/'+path
        }
      },
      debouncedModeUpdate: _debounce((_this, newVal) => {
        let language = detect(newVal)
        if (language !== 'Unknown') {
          _this.mode = language.toLowerCase()
          _this.setMode(_this.mode)
        } else {
          _this.mode = 'markdown'
          _this.setMode(_this.mode)
        }
      }, 500)
    },
    watch: {
      text (newVal) {
        let _this = this
        this.debouncedModeUpdate(this, newVal)
      }
    }
  }
</script>

<style>
@import '../../node_modules/sl-vue-tree/dist/sl-vue-tree-minimal.css';
@import '../../node_modules/sl-vue-tree/dist/sl-vue-tree-dark.css';
@import 'https://use.fontawesome.com/releases/v5.0.8/css/all.css';


  .grid-container {
    position: fixed !important;
    left: 0;
    right: 0;
    bottom: 0;
    top: 0;
    overflow: hidden;
    display: grid; 
    grid-column-gap: 0;
    grid-template-areas:
      "filestree editor"
      "statusbar statusbar";
    grid-template-columns: 250px auto;
    grid-template-rows: auto 25px;
  }
  #editor {
    grid-area: editor;
    overflow: hidden;
  }
  .statusbar {
    grid-area: statusbar;
    overflow: hidden;
    background: #007acc;
    padding: 0 20px;
  }
  .statusbar .element {
    float: right;
    color: rgb(255, 255, 255);
    cursor: pointer;
    display: inline-block;
    font-family: "Ubuntu", "Droid Sans", sans-serif;
    font-size: 14px;
    line-height: 22px;
    margin-left: 5px;
    padding-bottom: 0px;
    padding-left: 5px;
    padding-right: 5px;
    padding-top: 0px;
    overflow: hidden;
    outline: 0;
  }
  .statusbar .element select option{
    background: #2c2c27;
    color: #c0c0c0;
    cursor: pointer;
  }
  .statusbar .element select {
    border: 0;
    background: #007acc;
    font-family:Arial, Helvetica, sans-serif;
    font-size:18px;
    color:#fff;
    text-indent: 0.01px;
    text-overflow: "";
    -webkit-appearance: none;
    -moz-appearance: none;
    outline: 0;
  }
  .statusbar div#menuToggle {
    float: left;
  }
  .CodeMirror {
    border: 1px solid #eee;
    height: calc(100vh - 25px);
    font-size: 1.5em;
  }
  #filesTree{
    grid-area: filestree;
    background-color: #272822;
    overflow-y: auto;
  }
  #menuToggle
  {
    cursor: pointer;
    display: none;    
    z-index: 1;
    -webkit-user-select: none;
    user-select: none;
    height: 20px;
  }
  #menuToggle input
  {
    display: block;
    width: 25px;
    height: 25px;
    position: absolute;
    cursor: pointer;
    margin: 0;
    opacity: 0;
    z-index: 2;
    -webkit-touch-callout: none;
  }
  #menuToggle span
  {
    display: block;
    width: 25px;
    height: 3px;
    margin: 4px 0;
    position: relative;
    background: #cdcdcd;
    border-radius: 3px;
    z-index: 1;
    -webkit-transform-origin: 4px 0px;
  }
  @media only screen and (max-width: 768px){
    .hidemenu.grid-container {
      grid-template-areas:
          "editor"
          "statusbar" !important;
      grid-template-columns: 100% !important;
      grid-template-rows: calc(100% - 25px) 25px !important; 
    }
    .hidemenu#filesTree {
      display: none;
    }
    #menuToggle {
      display: block;
    }
  }
</style>
