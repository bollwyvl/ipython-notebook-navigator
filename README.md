# IPython Notebook Navigator
This is a standalone navigation enhancement for the IPython (>1.0) HTML 
Notebook.

## Screenshot
Coming Soon

## Features
- Thumbnails of input/output cells, scaled to their relative size in the notebook
- Click-to-scroll

### Roadmap
- Instant search of cells with highlight
- Visual indication of cell execution

## Browser Support and Limitations

- Firefox (latest): good!
- Chrome (latest): okay...
  - Offscreen elements aren't snapshotted correctly
- Safari 5: okay...
  - Same as Chrome
- IE: haven't checked

## Motivation
I had been kicking this idea around for a while, and had done some execution 
previously, but the state of JavaScript enhancement to the Notebook was still 
an issue under discussion.

At this point, it seems like a commitment has been made to `require.js`, which 
at least handles multi-file dependencies within a plugin, but still doesn't prevent every other UI enhancement from, for example, bringing in d3. 

## Installation

You basically need to:

- drop the files from this repository in your `<profile>static/custom` folder
- in that folder, create a `custom.js`
- to that file, add a call to `require` to the IPython Notebook Navigator `.js` file

Since we can safely assume you are using the IPython Notebook, here's a quick way to install it via the Notebook:
  
    import os
    import IPython
    from urllib import urlretrieve
    from zipfile import ZipFile

    profile = IPython.utils.path.locate_profile()
    custom = os.path.join(profile, "static", "custom")

    if not os.path.exists(custom):
        os.makedirs(custom)

    with open(os.path.join(custom, "custom.js"), "a+") as custom_js:
        custom_js.write('''
    require(["custom/ipython-notebook-navigator/ipynbnav"], function(ipynbnav){
      ipynbnav.init();
    });
    ''')

    nav_url = "https://github.com/bollwyvl/ipython-notebook-navigator/"

    zip_path, success = urlretrieve(nav_url, os.path.join(custom, "nav.zip"))

    with ZipFile(zip_path, "r") as nav_zip:
        nav_zip.extractall(custom)

    os.path.unlink(zip_path)

## License
This script is licensed under the [BSD 3-Clause License](LICENSE.txt).

For ease of installation, until IPython has a reasonable JavaScript package manager, the following libraries are distributed along with this code.

- [d3](http://d3js.org) is licensed under the BSD License
- [html2canvas](http://html2canvas.hertzen.com/) is licensed under the MIT License