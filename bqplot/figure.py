# Copyright 2015 Bloomberg Finance L.P.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

r"""

======
Figure
======

.. currentmodule:: bqplot.figure

.. autosummary::
   :toctree: generate/

   Figure
"""

from IPython.html.widgets import DOMWidget
from IPython.utils.traitlets import Unicode, Instance, List, Dict, Any, CFloat, Bool, Enum, Float

from .scales import Scale, LinearScale


class Figure(DOMWidget):

    """The base figure

    Make sure that the width is at least equal to the sum of the margins (perhaps there should be a validation enforcing this).

    The scale_x and scale_y scales are the scales used when you want to position something within the figure.  For example, the default scales have domain [0,1], which means that, for example, 0 in the x_scale means the left edge and 1 means the right edge.

    """
    _view_name = Unicode('bqplot.Figure', sync=True)

    title = Unicode(sync=True, exposed=True, display_index=1, display_name='Title')  #: The title of the figure

    min_width = CFloat(800.0, sync=True)  #: Minimum width for the figure, including margin
    min_height = CFloat(600.0, sync=True)  #: Minimum height for the figure, including margin
    fig_margin = Dict(dict(top=60, bottom=60, left=60, right=60), sync=True)   #: Margin the drawing takes place inside
    preserve_aspect = Bool(False, sync=True, exposed=True, display_index=3, display_name='Preserve aspect ratio')  #: Preserve the aspect ratio given by the minimum width and height

    axes = List(allow_none=False, sync=True)  #: List of axes
    marks = List(allow_none=False, sync=True)  #: List of marks
    overlay = Any(None, sync=True)  #: The overlay object

    legend_location = Enum(['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left'], default_value='top-right', sync=True,
                           exposed=True, display_index=2, display_name='Legend position')  #: The legend location

    scale_x = Instance(Scale, sync=True)  #: A scale instance for the horizontal global figure scale
    scale_y = Instance(Scale, sync=True)  #: A scale instance for the vertical global figure scale
    padding_x = Float(0, sync=True)  #: Padding to be applied for the figure in the x-direction on both sides
    padding_y = Float(0.025, sync=True)  #: Padding to be applied for the figure in the y-direction on both sides

    def _scale_x_default(self):
        return LinearScale(min=0, max=1)

    def _scale_y_default(self):
        return LinearScale(min=0, max=1)
