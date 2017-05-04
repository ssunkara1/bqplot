/* Copyright 2015 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var d3 = require("d3");
var _ = require("underscore");
var markmodel = require("./MarkModel");

var GraphModel = markmodel.MarkModel.extend({
    defaults: function() {
        return _.extend({}, markmodel.MarkModel.prototype.defaults, {
        _model_name: "GraphModel",
        _view_name: "Graph",

        x: [],
        y: [],
        color: null,
        hovered_point: null,
        scales_metadata: {
            x: { orientation: "horizontal", dimension: "x" },
            y: { orientation: "vertical", dimension: "y" },
            color: { dimension: "color" }
        },
        colors: [],
        });
    },

    initialize: function() {
        GraphModel.__super__.initialize.apply(this, arguments);
        this.on_some_change(["x", "y", "color",
                             "link_matrix", "node_labels"],
                            this.update_data, this);
        this.on_some_change(["preserve_domain"], this.update_domains, this);
        this.update_data();
    },

    update_node_data: function() {
        var node_labels = this.get("node_labels"),
            x_data = this.get_typed_field("x"),
            y_data = this.get_typed_field("y"),
            color_data = this.get_typed_field("color")
            scales = this.get("scales"),
            x_scale = scales.x,
            y_scale = scales.y,
            color_scale = scales.color;

        if (x_data.length !== 0 && y_data.length !== 0) {
            if (color_scale) {
                if (!this.get("preserve_domain").color) {
                    color_scale.compute_and_set_domain(color_data,
                                                       this.id + "_color");
                } else {
                    color_scale.del_domain([], this.id + "_color");
                }
            }

            this.mark_data = node_labels.map(function(d, i) {
                return {
                    name: d,
                    x: x_data[i],
                    y: y_data[i],
                    color: color_data[i],
                    node_label: node_labels[i],
                    index: i
                };
            });
        } else {
            this.mark_data = node_labels.map(function(d, i) {
                return {
                    name: d,
                    index: i,
                    
                };
            });
        }
    },

    update_link_data: function() {
        var link_matrix = this.get_typed_field("link_matrix");
        //coerce link matrix into format understandable by d3 force layout
        this.link_data = [];
        var that = this;
        link_matrix.forEach(function(d, i) {
            d.forEach(function(e, j) {
                if (e !== null) {
                    that.link_data.push({source: i, target: j, value: e});
                }
            })
        });
    },

    update_data: function() {
        this.dirty = true;
        this.update_node_data();
        this.update_link_data();
        this.update_unique_ids();
        this.update_domains();
        this.dirty = false;
        this.trigger("data_updated");
    },

    update_unique_ids: function() {},

    get_data_dict: function(data, index) {
        return data;
    },

    update_domains: function() {
        if (!this.mark_data) {
            return;
        }

        var scales = this.get("scales");
        for (var key in scales) {
            if (scales.hasOwnProperty(key) && key != "color") {
                var scale = scales[key];
                if (!this.get("preserve_domain")[key]) {
                    scale.compute_and_set_domain(this.mark_data.map(function(d)
                    {
                        return d[key];
                    }), this.id + key);
                } else {
                    scale.del_domain([], this.id + key);
                }
            }
       }
    }
});

module.exports = {
    GraphModel: GraphModel
};
{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "from __future__ import print_function\n",
    "import keras\n",
    "from keras.datasets import mnist\n",
    "from keras.models import Sequential\n",
    "from keras.layers import Dense, Dropout, Flatten\n",
    "from keras.layers import Conv2D, MaxPooling2D\n",
    "from keras.callbacks import Callback\n",
    "from keras import backend as K\n",
    "from keras.utils.np_utils import to_categorical"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "from bqplot import pyplot as plt\n",
    "from bqplot import ColorScale, OrdinalScale, OrdinalColorScale, CATEGORY10\n",
    "from ipywidgets import HBox, VBox, Layout, FloatProgress, Label, IntSlider, Dropdown\n",
    "from IPython.display import display\n",
    "import numpy as np"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "batch_size = 128\n",
    "num_classes = 10\n",
    "epochs = 20\n",
    "\n",
    "# input image dimensions\n",
    "img_rows, img_cols = 28, 28\n",
    "\n",
    "# the data, shuffled and split between train and test sets\n",
    "(x_train, y_train), (x_test, y_test) = mnist.load_data()"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "x_train = x_train.astype('float32')\n",
    "x_test = x_test.astype('float32')\n",
    "x_train /= 255\n",
    "x_test /= 255\n",
    "print('x_train shape:', x_train.shape)\n",
    "print(x_train.shape[0], 'train samples')\n",
    "print(x_test.shape[0], 'test samples')"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "train_test_dd = Dropdown(options=['Train', 'Test'])\n",
    "sel_slid = IntSlider(min=0, max=x_train.shape[0]-1, description='Index')\n",
    "fig_map = plt.figure()\n",
    "heat_map = plt.heatmap(color=x_train[0][::-1], scales={'color': ColorScale(scheme='Greys')},\n",
    "                      axes_options={'x': {'visible': False},\n",
    "                                    'y': {'visible': False},\n",
    "                                    'color': {'visible': False}})\n",
    "\n",
    "def slid_changed(change):\n",
    "    heat_map.color = x_train[sel_slid.value][::-1]\n",
    "    \n",
    "def dd_changed(change):\n",
    "    sel_slid.value = 0\n",
    "    if train_test_dd.value == 'Train':\n",
    "        sel_slid.max = x_train.shape[0]\n",
    "    else:\n",
    "        sel_slid.max = x_test.shape[0]\n",
    "    \n",
    "    slid_changed(None)\n",
    "    \n",
    "sel_slid.observe(slid_changed, 'value')\n",
    "train_test_dd.observe(dd_changed, 'value')"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "VBox([HBox([train_test_dd, sel_slid]), fig_map])"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "from sklearn.manifold import TSNE"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "tsne_x = x_train[:1000, :, :].reshape(1000, 784)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "axes_opt = {'x': {'visible': False},\n",
    "                                    'y': {'visible': False},\n",
    "                                    'color': {'visible': False}}"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "tsn = TSNE()\n",
    "low_x = tsn.fit_transform(tsne_x)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false
   },
   "outputs": [],
   "source": [
    "tt_fig = plt.figure(min_height='200px')\n",
    "hmap_sc = ColorScale(scheme='Greys')\n",
    "hmap = plt.heatmap(x_train[0][::-1], scales={'color': hmap_sc}, axes_options=axes_opt)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "fig = plt.figure(title='TSNE with Hover')\n",
    "ind = 1000\n",
    "ord_sc = OrdinalColorScale(colors=CATEGORY10)\n",
    "scat = plt.scatter(low_x[:ind, 0], low_x[:ind, 1], color=y_train[:ind], tooltip=tt_fig, scales={'color':ord_sc},\n",
    "                  stroke='Black')"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true
   },
   "outputs": [],
   "source": [
    "def hovered(name, value):\n",
    "    if scat.hovered_point is not None:\n",
    "        hmap.color = x_train[scat.hovered_point, :, :][::-1]\n",
    "    \n",
    "scat.on_hover(hovered)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false
   },
   "outputs": [],
   "source": [
    "fig"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "class Dashboard(Callback):\n",
    "    \n",
    "    def __init__(self):\n",
    "        self.train_loss = []\n",
    "        self.test_loss = []\n",
    "        \n",
    "        self.fig_line = plt.figure(title='Training and Test Errors')\n",
    "        self.lines = plt.plot([0], [0], colors=['DeepSkyBlue', 'Red'], labels=['Training', 'Test'],\n",
    "                              display_legend=True)\n",
    "        \n",
    "        self.fig_wts = plt.figure(title='L1 Norm of Weights - by layer')\n",
    "        self.bars = plt.bar([0],[0], colors=['MediumSeaGreen'], scales={'x': OrdinalScale()})\n",
    "        self.train_label = Label(value='Train Accuracy: ', layout=Layout(width='800px'))\n",
    "        self.test_label = Label(value='Test Accuracy: ', layout=Layout(width='800px'))\n",
    "        self.prog_bar = FloatProgress(description='Epoch 0')\n",
    "        self.layout = VBox([self.prog_bar, HBox([self.fig_line, self.fig_wts]), self.train_label, self.test_label],\n",
    "                          layout=Layout(flex='1'))\n",
    "        display(self.layout)\n",
    "        \n",
    "    def on_train_begin(self, logs={}):\n",
    "        self.prog_bar.min, self.prog_bar.max = 0, self.params['nb_epoch']\n",
    "        self.bars.x = list(np.arange(0, len(self.model.layers)))\n",
    "        \n",
    "    def on_epoch_end(self, epoch, log={}):\n",
    "        epoch_train_acc = np.mean(np.argmax(self.model.predict(x_train_flat), axis=1)==y_train)\n",
    "        epoch_test_acc = np.mean(np.argmax(self.model.predict(x_test_flat), axis=1)==y_test)\n",
    "        \n",
    "        self.train_loss.append(1 - epoch_train_acc)\n",
    "        self.test_loss.append(1 - epoch_test_acc)\n",
    "\n",
    "        self.lines.x, self.lines.y = np.arange(0, epoch), [self.train_loss, self.test_loss]\n",
    "        \n",
    "        weight_norm = []\n",
    "        for layer in np.arange(0, len(self.model.layers)):\n",
    "            wts = self.model.layers[layer].get_weights()[0]\n",
    "            weight_norm.append(np.sum(np.abs(wts)) / wts.shape[0])\n",
    "        self.bars.y = weight_norm\n",
    "        \n",
    "        self.prog_bar.description = 'Epoch ' + str(epoch + 1) + '/' + str(self.params['nb_epoch'])\n",
    "        self.prog_bar.value += 1.\n",
    "        \n",
    "        self.train_label.value = 'Train Accuracy: ' + str(epoch_train_acc)\n",
    "        self.test_label.value = 'Test Accuracy: ' + str(epoch_test_acc)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "x_train_flat = x_train.reshape(60000, 784)\n",
    "x_test_flat = x_test.reshape(10000, 784)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": true,
    "deletable": true,
    "editable": true
   },
   "outputs": [],
   "source": [
    "# convert class vectors to binary class matrices\n",
    "y_train_cat = to_categorical(y_train, num_classes)\n",
    "y_test_cat = to_categorical(y_test, num_classes)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {
    "collapsed": false,
    "deletable": true,
    "editable": true,
    "scrolled": true
   },
   "outputs": [],
   "source": [
    "model = Sequential()\n",
    "model.add(Dense(50, activation='relu', input_shape=(784,)))\n",
    "model.add(Dense(50, activation='relu'))\n",
    "model.add(Dense(10, activation='softmax'))\n",
    "\n",
    "model.compile(loss=keras.metrics.categorical_crossentropy,\n",
    "              optimizer=keras.optimizers.Adadelta(),\n",
    "              metrics=['accuracy'], verbose=False)\n",
    "\n",
    "_ = model.fit(x_train_flat, y_train_cat,\n",
    "          batch_size=batch_size,\n",
    "          nb_epoch=epochs,\n",
    "          verbose=False,\n",
    "          validation_data=(x_test_flat, y_test_cat), callbacks=[Dashboard()])"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 2",
   "language": "python",
   "name": "python2"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 2
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython2",
   "version": "2.7.12"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 2
}