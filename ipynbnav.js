;(function(define, IPython){
  "use strict";

  // require.js import... html2canvas/d3 don"t support require, so "fudge" it
  define([
      "./lib/d3/d3",
      "./lib/html2canvas/html2canvas"
    ],
  function(){
    // the public API... returned way at the bottom!
    var ipynbnav = {};

    // private variables
    var _thumbnail_queue = [],
      _queue_state = 0,
      _thumbnail_cache = {},
      _debug = true;

    // interesting events after which we"ll want to trigger a render
    var _events = {
      SELECT: "select.Cell",
      DELETE: "delete.Cell",
      RESIZE: "notebook_resized.LayoutManager",
      LOAD:   "notebook_loaded.Notebook",
      NEXT:   "set_next_input.Notebook",
      EXEC:   "execution_request.Kernel"
    };


    ipynbnav.init = function(){
      // set up the environment
      var notebook = d3.select("#notebook");

      ipynbnav.div = notebook
        .insert("div", ":first-child")
        .attr("id", "ipynbnav")
        .attr("class", "well")
        .style("position", "absolute")
        .style("width", "75px")
        .style("top", "5px")
        .style("right", "15px")
        .style("padding", "0 12px 8px 0")
        .style("z-index", 9999);

      ipynbnav.render();
      ipynbnav.events();
    };


    ipynbnav.events = function(){
      // attach events

      d3.entries(_events).map(function(evt){
        $([IPython.events]).on(evt.value, function(){
          if(evt.key === "SELECT"){ return; }
          _debug && console.debug(evt.value, "RENDER", arguments);
          ipynbnav.render.apply(arguments);
        });
      });
    };


    ipynbnav.render = function(){
      // main render function... needs to be broken up further, likely
      var changed = arguments.length === 2 && arguments[1].cell ? arguments[1].cell : null;

      // grab the notebook cells
      var cells = IPython.notebook.get_cells();

      // do height tomfoolery
      var heights = cells.map(function(cell){
          return cell.element.height();
        }),
      height = d3.scale.linear()
        .domain([0, d3.sum(heights)])
        .range([0,  $("#notebook").height() - heights.length * 5]);

      // the row DOM objects
      var rows = ipynbnav.div.selectAll(".nav-cell")
        .data(cells, function(cell){ return cell.cell_id; })
        // reorder DOM based on the order the cells have
        .order();

      // init cells
      rows.enter()
        .append("div")
        .attr("class", "btn-group nav-cell")
        .style("width", "100%")
        .style("margin", "0 5px 2px 5px")
        .style("padding", 0);

      // update their heights
      rows
        .style("height", function(d, i){ return height(heights[i]) + "px" })

      // setup the thumbnails for the input and output cells
      rows.each(ipynbnav.thumbnail("input"));
      rows.each(ipynbnav.thumbnail("output"));

      // destroy hanging DOM
      rows.exit().remove();
    };


    ipynbnav.thumbnail = function(in_out){
      // generate a thumbnail.. this actually generates a callback

      // determine which area to use... this is the input default
      var get_area = function(cell){
        switch(cell.cell_type){
          case "code":
            return cell.element.find(".CodeMirror-lines")[0];
          case "markdown":
            return cell.element.find(".text_cell_input")[0];
        }
        console.warn("navigator: didn't implement input", cell.cell_type);
      };

      if(in_out === "output"){
        // maybe reassign the function
        get_area = function(cell){
          switch(cell.cell_type){
            case "code":
              return cell.output_area.selector[0];
            case "markdown":
              return cell.element.find(".text_cell_render")[0];
          }
          console.warn("navigator: didn't implement output", cell.cell_type);
        }
      }

      return function(cell){
        // the returned callback that actually works with the DOM
        var row = d3.select(this),
          thumb = row.selectAll(".ipynbnav-" + in_out).data([1]),
          area;

        // set up the bootstrap button area for the thumbnail
        thumb.enter().append("div")
          .attr("class", "ipynbnav-thumb btn ipynbnav-" + in_out)
          .style("width", "50%")
          .style("overflow", "hidden")
          .style("padding", 0)
          .style("background-size", "cover")
          .style("background-position", "top left");

        // always update the height... here cheating by looking at the row
        thumb
          .style("height", function(){ return row.style("height"); })
          .on("click", ipynbnav.thumb_clicked(cell, get_area));

        // request a thumbnail for sometime later...
        ipynbnav.push_thumbnail(
          ipynbnav.thumbnail_request(cell, get_area, thumb, in_out)
        );
      }
    }


    ipynbnav.thumb_clicked = function(cell, get_area){
      return function(){
        // handle a click... TODO: allow for execution?
        var area = get_area(cell),
          notebook = IPython.notebook.element[0];

        if(!area){
          area = cell.element[0]
        }else if(!area.offsetTop && area.parentNode !== cell.element[0]){
          area = $(area).parentsUntil(cell.element).slice(-1)[0];
        }

        // remember the scroll top...
        var old_scrollTop = notebook.scrollTop;

        // because this whacks it, instantly...
        $([IPython.events]).trigger(_events.SELECT, {"cell": cell});

        d3.select(notebook)
          // so set it back
          .property("scrollTop", old_scrollTop)
        .transition()
          // and then ease to the right scroll location
          .duration(500)
          .tween("scrollTop", scrollTopTween(area.offsetTop));
      };
    };

    ipynbnav.needs_snapshot = function(thumb, area, cell, in_out){
      // many reasons we may not need a snapshot

      var thumb_key = ipynbnav.thumbnail_keys(cell)[in_out];

      if(ipynbnav.cache(thumb_key)){ return false; }
      if(!area){ return false; }
      if(thumb.select("i").node() !== null){ return false; }
      if(!cell.get_text()){ return false; }

      // apparently, h2c will explode if the element has a 0 w/h
      var bcr = area.getBoundingClientRect();

      if(!bcr.width || !bcr.height){ return false; }

      return true;
    };


    ipynbnav.thumbnail_keys = function(cell){
      var thumb_key = [cell.cell_id,
          cell.input_prompt_number
        ].join("-");

        return {
          input: thumb_key + "-input",
          output: thumb_key + "-output"
        }
    };

    ipynbnav.cache = function(key, value){
      if(arguments.length === 1){
        return _thumbnail_cache[key];
      }
      _thumbnail_cache[key] = "url(" + value + ")";
    };

    ipynbnav.queue_state = function(value){
      if(!arguments.length){ return _queue_state; }
      _queue_state = value;
    };

    ipynbnav.thumbnail_request = function(cell, get_area, thumb, in_out){
      // the callback request... could be class, I guess

      return function(){
        // try to determine if we've already done this thumbnail
        var thumb_key = ipynbnav.thumbnail_keys(cell)[in_out];

        var done = function(){
          // a completion function which updates the queue state and reads cache

          // exiting the critical region
          ipynbnav.queue_state(0);

          thumb.style("background-image", ipynbnav.cache(thumb_key));

          // always attempt to remove the loading indicator
          thumb.selectAll("i").remove();

          // recurse
          ipynbnav.pop_thumbnail();
        };

        setTimeout(function(){
          var area;

          // attempt to get the area for snapshotting...
          try{
             area = get_area(cell);
          }catch(e){
            // if there isn't one (collapsed, hidden?) just ignore it
            return done();
          }


          // various reasons we wouldn't want a snapshot
          if(!ipynbnav.needs_snapshot(thumb, area, cell, in_out)){
            return done();
          }

          // entering the critical region
          ipynbnav.queue_state(1);

          // ok, there is an area we want a snapshot of... set up the loading pic
          thumb.append("i")
            .attr("class", "icon-camera")
            .style("opacity", 0.5);


            // actually request the thumbnail
          html2canvas(area, {
            onrendered: function(canvas){
              if(cell.cell_type === "code" && in_out === "output"){
                var tempCanvas = document.createElement("canvas"),
                  ctx = tempCanvas.getContext("2d");

                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;

                ctx.translate(-85,0);
                ctx.drawImage(canvas,0,0);

                canvas = tempCanvas;
              }

              // callback to update cache, then finish the call
              ipynbnav.cache(thumb_key, canvas.toDataURL());

              done();
            }
          });
        }, 0);
      }
    };


    ipynbnav.push_thumbnail = function(request){
      // queue up (and potentially initiate) a request for a thumbnail

      // push this
      _thumbnail_queue.push(request);

      if(!ipynbnav.queue_state()){ ipynbnav.pop_thumbnail(); }
    };


    ipynbnav.pop_thumbnail = function(){
      // start the queue (if it isn't running)

      if(!ipynbnav.queue_state() && _thumbnail_queue.length){
        _thumbnail_queue.pop()();
        return true;
      }
    };

    // http://bl.ocks.org/mbostock/1649463
    function scrollTopTween(scrollTop) {
      return function(){
        var i = d3.interpolateNumber(this.scrollTop, scrollTop);
        return function(t){
          this.scrollTop = i(t);
        };
      };
    }

    // return the public API
    return ipynbnav;
  });
}).call(this, define, IPython);