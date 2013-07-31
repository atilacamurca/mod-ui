/*
 * Copyright 2012-2013 AGR Audio, Industria e Comercio LTDA. <contato@portalmod.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function Desktop(elements) {
    var self = this

    // The elements below are expected to be all defined in HTML and passed as parameter
    elements = $.extend({
	titleBox: $('<div>'),
	pedalboard: $('<div>'),
	zoomIn: $('<div>'),
	zoomOut: $('<div>'),
	saveBox: $('<div>'),
	saveButton: $('<div>'),
	saveAsButton: $('<div>'),
	resetButton: $('<div>'),
	disconnectButton: $('<div>'),
	effectBox: $('<div>'),
	effectBoxTrigger: $('<div>'),
	pedalboardTrigger: $('<div>'),
	pedalboardBox: $('<div>'),
	pedalboardBoxTrigger: $('<div>'),
	bankBox: $('<div>'),
	bankBoxTrigger: $('<div>'),
	bankList: $('<div>'),
	bankPedalboardList: $('<div>'),
	bankSearchResult: $('<div>'),
	socialTrigger: $('<div>'),
	socialWindow: $('<div>'),
	loginWindow: $('<div>'),
	shareButton: $('<div>'),
	shareWindow: $('<div>'),
	xRunNotifier: $('<div>'),
	userName: $('<div>'),
	userAvatar: $('<div>'),
	logout: $('<div>')
    }, elements)

    this.installationQueue = new InstallationQueue()
    this.windowManager = new WindowManager();
    this.feedManager = new FeedManager({
	// just for testing
	alert: function(event) {
	    alert(event.message)
	}
    });
    this.userSession = new UserSession({
	loginWindow: elements.loginWindow,
        online: function() {
            elements.socialTrigger.addClass('selected')
	    
        },
        offline: function() {
            elements.socialTrigger.removeClass('selected')
        },
	login: function() {
	    elements.userName.show().html(self.userSession.user.name).click(function() {
		alert('user profile')
		return false
	    })
	    elements.userAvatar.show().attr('src', 'http://gravatar.com/avatar/' + self.userSession.user.gravatar)
	    self.feedManager.start(self.userSession.sid)
	},
	logout: function() {
	    elements.userName.hide()
	    elements.userAvatar.hide()
	    
	}
    });
    elements.logout.click(function() {
	self.userSession.logout()
	self.windowManager.closeWindows() 
	return false
    })
    this.userSession.getSessionId()
    this.hardwareManager = new HardwareManager({
	address: function(instanceId, symbol, addressing, callback) {
	    addressing.actuator = addressing.actuator || [-1, -1, -1, -1]
	    if (symbol == ':bypass') {
		var url = instanceId
		url += ',' + addressing.actuator.join(',')
		url += ',' + (addressing.value ? 1 : 0)
		url += ',' + addressing.label
		$.ajax({ url: '/effect/bypass/address/' + url,
			 success: function (resp) {
			     callback(resp.ok, resp)
			 },
			 error: function () {
			     new Bug("Couldn't address bypass")
			     callback(false)
			 },
			 dataType: 'json'
		       })
	    } else {
		$.ajax({ url: '/effect/parameter/address/' + instanceId + ',' + symbol,
			 type: 'POST',
			 data: JSON.stringify(addressing),
			 success: function(resp) {
			     callback(resp.ok, resp)
			 },
			 error: function() {
			     new Bug("Couldn't address parameter")
			     callback(false)
			 },
			 dataType: 'json'
		       })
	    }
	},
	getGui: function(instanceId) {
	    return self.pedalboard.pedalboard('getGui', instanceId)
	},
	renderForm: function(instanceId, port) {
	    context = $.extend({ 
		plugin: self.pedalboard.pedalboard('getGui', instanceId).effect
	    }, port)
	    console.log(context)
	    if (port.symbol == ':bypass')
		return Mustache.render(TEMPLATES.bypass_addressing, context)
	    else
		return Mustache.render(TEMPLATES.addressing, context)
	}
    })

    this.metadata = {}

    // Indicates that pedalboard is in an unsaved state
    this.pedalboardModified = false

    this.pedalboard = self.makePedalboard(elements.pedalboard)
    elements.zoomIn.click(function() { self.pedalboard.pedalboard('zoomIn') })
    elements.zoomOut.click(function() { self.pedalboard.pedalboard('zoomOut') })

    elements.pedalboardTrigger.click(function() { 
	self.windowManager.closeWindows() 
    })

    this.titleBox = elements.titleBox
    this.effectBox = elements.effectBox.effectBox({
	windowManager: this.windowManager,
	pedalboard: this.pedalboard,
	removePlugin: function(plugin, callback) {
	    if (!confirm('You are about to remove this effect and any other in the same bundle. This may break pedalboards in banks that depends on these effects'))
		return
	    $.ajax({ url: '/package/'+plugin.package+'/uninstall',
		     method: 'POST',
		     success: callback,
		     error: function() {
			 new Notification('error', "Could not uninstall " + plugin.package)
		     },
		     dataType: 'json'
		   })
	},
	upgradePlugin: function(plugin, callback) {
	    self.installationQueue.install(plugin.url, callback)
	},
	installPlugin: function(plugin, callback) {
	    self.installationQueue.install(plugin.url, callback)
	}
    })

    this.pedalboardListFunction = function(callback) {
	$.ajax({'method': 'GET',
		'url': '/pedalboard/list',
		'success': callback,
		'dataType': 'json'
	       })
    }
    this.pedalboardSearchFunction = function(local, query, callback) {
	var url = local ? '' : SITEURL
	$.ajax({'method': 'GET',
		'url': url + '/pedalboard/search/?term='+escape(query),
		'success': function(pedalboards) {
		    callback(pedalboards, url)
		},
		'dataType': 'json'
	       })
    }

    this.disconnect = function() {
	    $.ajax({ url: '/disconnect',
		     success: function(resp) {
			 if (!resp)
			     return new Notification('error', 
						     "Couldn't disconnect")
			 var block = $('<div class="screen-disconnected">')
			 block.html('Disconnected')
			 $('body').append(block).css('overflow', 'hidden')
			 block.width($(window).width() * 5)
			 block.height($(window).height() * 5)
			 block.css('margin-left', -$(window).width() * 2)
			 $('#wrapper').css('z-index', -1)
		     },
		     error: function() {
			 new Bug("Couldn't disconnect")
		     }
		   })
	}

    this.pedalboardBox = self.makePedalboardBox(elements.pedalboardBox,
						elements.pedalboardBoxTrigger)
    this.bankBox = self.makeBankBox(elements.bankBox,
				    elements.bankBoxTrigger)
    /*
    this.userBox = elements.userBox.userBox()
    //this.xrun = elements.xRunNotifier.xRunNotifier()
    */
    this.socialWindow = elements.socialWindow.socialWindow({
	windowManager: self.windowManager,
	getFeed: function(callback) { 
	    $.ajax({ url: SITEURL + '/pedalboard/feed/'+self.userSession.sid,
		     success: function(pedalboards) {
			 console.log(pedalboards)
			 callback(pedalboards)
		     },
		     error: function() {
			 new Notification('error', 'Cannot contact cloud')
		     },
		     dataType: 'json'
		   })
	},
	loadPedalboard: function(pedalboard) {
	    self.reset(function() {
		self.pedalboard.pedalboard('unserialize', pedalboard.pedalboard, 
					   function() {
					       self.pedalboardModified = true
					       self.windowManager.closeWindows()
					   }, false)
	    }, true)
	}
    })
    elements.socialTrigger.click(function() {
    	self.userSession.login(function() { self.socialWindow.socialWindow('open') })
    })

    this.saveBox = elements.saveBox.saveBox({
	save: function(pedalboard, callback) {    
	    $.ajax({
		url: '/pedalboard/save',
		type: 'POST',
		data: JSON.stringify(pedalboard),
		success: function(result) {
		    if (result.ok)
			callback(result.uid)
		    else
			callback(false, result.error)
		},
		error: function(resp) {
		    self.saveBox.hide()
		    new Bug("Couldn't save pedalboard")
		},
		dataType: 'json'
	    });
	}
    })

    elements.saveButton.click(function() {
	self.saveCurrentPedalboard(false)
    })
    elements.saveAsButton.click(function() {
	self.saveCurrentPedalboard(true)
    })
    elements.resetButton.click(function() {
	self.reset()
    })
    elements.disconnectButton.click(function() {
	self.disconnect()
    })


    elements.shareButton.click(function() {
	var share = function() {
	    self.userSession.login(function() { 
		self.pedalboard.pedalboard('serialize', 
					   function(pedalboard) {
					       if (!self.pedalboardId)
						   return new Notification('warn', 'Nothing to share')
					       elements.shareWindow.shareBox('open', self.pedalboardId, self.titleBox.text(), pedalboard)
					   })
	    })
	}
	if (self.pedalboardModified) {
	    if (confirm('There are unsaved modifications, pedalboard must first be saved. Save it?'))
		self.saveCurrentPedalboard(false, share)
	    else
		return
	} else {
	    share()
	}
    })

    elements.shareWindow.shareBox({ 
	takeScreenshot: function(uid, callback) {
	    $.ajax({ url: '/pedalboard/screenshot/'+uid,
		     success: callback,
		     error: function() {
			 new Bug("Can't generate screenshot")
		     },
		     dataType: 'json'
		   })
	},
	share: function(data, callback) {
	    $.ajax({ url: SITEURL + '/pedalboard/share/' + self.userSession.sid,
		     method: 'POST',
		     data: JSON.stringify(data),
		     success: function(resp) {
			 callback(resp.ok)
		     },
		     error: function() {
			 new Notification('error', "Can't share pedalboard")
		     },
		     dataType: 'json'
		   })
	},
    })

    $(document).bind('ajaxSend', function() {
	$('body').css('cursor', 'wait')
    })
    $(document).bind('ajaxComplete', function() {
	$('body').css('cursor', 'default')
    })
}

Desktop.prototype.makePedalboard = function(el) {
    var self = this
    el.pedalboard({
	windowManager: self.windowManager,
	hardwareManager: self.hardwareManager,
	pluginLoad: function(url, instanceId, callback) {
	    var firstTry = true
	    var add = function() {
		$.ajax({ url: '/effect/add/'+instanceId+'?url='+escape(url),
			 success: function(pluginData) {
			     if (pluginData)
				 callback(pluginData)
			     else
				 new Notification('error',
						  'Error adding effect')
			 },
			 error: function(resp) {
			     if (resp.status == 404 && firstTry) {
				 firstTry = false
				 self.installationQueue.install(url, add)
			     } else {
				 new Bug('Error adding effect')
			     }
			 },
			 'dataType': 'json'
		       })
	    }
	    add()
	},

	pluginRemove: function(instanceId, callback) { 
	    $.ajax({ 'url': '/effect/remove/' + instanceId,
		     'success': function(resp) {
			 if (resp)
			     callback()
			 else
			     new Notification("error", "Couldn't remove effect")
		     },
		     'dataType': 'json'
		   })
	},

	pluginParameterChange: function(instanceId, symbol, value, callback) {
	    $.ajax({ url: '/effect/parameter/set/' + instanceId + ',' + symbol,
		     data: { value: value },
		     success: function(resp) {
			 /*
			   // TODO trigger
			   if (!resp || self.data('trigger')) {
			   self.data('value', oldValue)
			   self.widget('sync')
			   }
			 */
			 if (!resp)
			     alert('erro na parametrizacao: '+resp)
		     },
		     error: function() {
			 /*
			   self.data('value', oldValue)
			   self.widget('sync')
			   alert('erro no request (6)')
			 */
		     },
		     'dataType': 'json'
		   })
	},

	pluginBypass: function(instanceId, bypassed, callback) {
	    var value = bypassed ? 1 : 0
	    $.ajax({ url: '/effect/bypass/' + instanceId + ',' + value,
		     success: function(resp) {
			 if (!resp)
			     alert('erro')
			 callback(!!resp)
		     },
		     error: function() {
			 alert('erro no request')
		     },
		     dataType: 'json'
		   })
	},

	portConnect: function(fromInstance, fromSymbol, toInstance, toSymbol, callback) {
	    var urlParam = fromInstance + ':' + fromSymbol + ',' + toInstance + ':' + toSymbol
	    $.ajax({ url: '/effect/connect/' + urlParam,
		     success: function(resp) {
			 callback(resp)
			 if (!resp) {
			     alert('erro')
			 }
		     },
		     dataType: 'json'
		   })
	},

	portDisconnect: function(fromInstance, fromSymbol, toInstance, toSymbol, callback) {
	    var urlParam = fromInstance + ':' + fromSymbol + ',' + toInstance + ':' + toSymbol
	    $.ajax({ url: '/effect/disconnect/' + urlParam,
		     success: function() {
			 callback(true)
		     },
		     dataType: 'json'
		   })
	},

	reset: function(callback) {
	    $.ajax({ url: '/reset',
		     success: function(resp) {
			 if (!resp)
			     return new Notification('error', 
						     "Couldn't reset pedalboard")

			 /*
			   var dialog = self.data('shareDialog')
			   dialog.find('.js-title').val('')
			   dialog.find('.js-tags').tagField('val', [])
			   dialog.find('.js-musics').tagField('val', [])
			   dialog.find('.js-description').val('')
			 */

			 self.titleBox.text('Untitled')
			 
			 callback(true)
		     },
		     error: function() {
			 new Bug("Couldn't reset pedalboard")
		     }
		   })
	},

        pedalboardLoad: function(uid, callback) {
            $.ajax({
                url: '/pedalboard/load/' + uid,
                type: 'GET',
                contentType: 'application/json',
                success: function(result) {
                    if (result !== true) {
                        new Notification('error', "Error loading pedalboard");
                    }
                    callback(!!result);
                },
                dataType: 'json'
            });
        },

	getPluginsData: function(urls, callback) {
            $.ajax({
		url: '/effect/bulk/',
		type: 'POST',
		contentType: 'application/json',
		data: JSON.stringify(urls),
		success: callback,
		dataType: 'json'
            })
	}

    });

    // Add hardware ports
    var outputL = $('<div class="hardware-output" title="Hardware Audio Input 1">')
    var outputR = $('<div class="hardware-output" title="Hardware Audio Input 2">')
    var outputM = $('<div class="hardware-output" title="Hardware MIDI Input">')
    var inputL = $('<div class="hardware-input" title="Hardware Audio Output 1">')
    var inputR = $('<div class="hardware-input" title="Hardware Audio Output 2">')
    
    el.pedalboard('addHardwareOutput', outputL, 'capture_1', 'audio')
    el.pedalboard('addHardwareOutput', outputR, 'capture_2', 'audio')
    el.pedalboard('addHardwareOutput', outputM, 'midi_capture_1', 'midi')
    el.pedalboard('addHardwareInput', inputL, 'playback_1', 'audio')
    el.pedalboard('addHardwareInput', inputR, 'playback_2', 'audio')

    el.pedalboard('positionHardwarePorts')

    // Bind events
    el.bind('modified', function() {
	self.pedalboardModified = true
    })
    el.bind('dragStart', function() {
	self.windowManager.closeWindows()
    })
    el.bind('pluginDragStart', function() {
	self.effectBox.window('fade')
    })
    el.bind('pluginDragStop', function() {
	self.effectBox.window('unfade')
    })

    return el
}

Desktop.prototype.makePedalboardBox = function(el, trigger) {
    var self = this
    return el.pedalboardBox({
	trigger: trigger,
 	windowManager: this.windowManager,
	list: self.pedalboardListFunction,
	search: self.pedalboardSearchFunction,
	remove: function(pedalboard, callback) {
	    if (!confirm(sprintf('The pedalboard "%s" will be permanently removed! Confirm?', pedalboard.title)))
		return
	    $.ajax({ url: '/pedalboard/remove/' + pedalboard._id,
		     success: function() {
			 new Notification("info", sprintf('Pedalboard "%s" removed', pedalboard.title))
			 callback()
		     },
		     error: function() {
			 new Bug("Couldn't remove pedalboard")
		     }
		   })
	},
	load: function(pedalboardId, callback) {
	    $.ajax({
		url: '/pedalboard/get/' + pedalboardId,
		type: 'GET',
		success: function(pedalboard) {
		    self.reset(function() {
			self.pedalboard.pedalboard('unserialize', pedalboard, 
						   function() {
						       self.pedalboardId = pedalboard._id
						       self.metadata = pedalboard.metadata
						       self.titleBox.text(pedalboard.metadata.title)
						       self.pedalboardModified = false
						       callback()
						   }, true)
		    }, true)
		},
		error: function() {
		    new Bug("Couldn't load pedalboard")
		},
		dataType: 'json'
	    })
	},
	duplicate: function(pedalboard, callback) {
	    var duplicated = $.extend({}, pedalboard)
	    delete duplicated._id
	    self.saveBox.saveBox('save', duplicated, callback)
	}
    })
}

Desktop.prototype.makeBankBox = function(el, trigger) {
    var self = this
    el.bankBox({
	trigger: trigger,
 	windowManager: this.windowManager,
	list: self.pedalboardListFunction,
	search: self.pedalboardSearchFunction,
	load: function(callback) {
	    $.ajax({ url: '/banks',
		     success: callback,
		     error: function() {
			 new Bug("Couldn't load banks")
		     },
		     dataType: 'json',
		   })
	},
	save: function(data, callback) {
	    $.ajax({ type: 'POST',
		     url: '/banks/save',
		     data: JSON.stringify(data),
		     error: function() {
			 new Bug("Couldn't save banks")
		     },
		   })
	}
    })
}

Desktop.prototype.reset = function(callback, bypassApplication) {
    if (this.pedalboardModified)
	if (!confirm("There are unsaved modifications that will be lost. Are you sure?"))
	    return
    this.pedalboardId = null
    this.metadata = {}
    this.pedalboardModified = false
    this.pedalboard.pedalboard('reset', callback, bypassApplication)
}

Desktop.prototype.saveCurrentPedalboard = function(asNew, callback) {
    var self = this
    self.pedalboard.pedalboard('serialize', 
			       function(pedalboard) {
				   if (!asNew)
				       pedalboard._id = self.pedalboardId
				   pedalboard.metadata = self.metadata
				   pedalboard.metadata.tstamp = new Date().getTime()
				   self.saveBox.saveBox('save', pedalboard,
							function(pedalboard) {
							    self.pedalboardId = pedalboard._id
							    self.metadata = pedalboard.metadata
							    self.pedalboardModified = false
							    var title = pedalboard.metadata.title
							    self.titleBox.text(title)
							    new Notification("info", 
									     sprintf('Pedalboard "%s" saved', title),
									     2000)
							    if (callback)
								callback()
							})
			       })
}

JqueryClass('saveBox', {
    init: function(options) {
	var self = $(this)

	options = $.extend({
	    save: function(data, callback) { callback(true) }
	}, options)

	self.data(options)

	var save = function() {
	    var pedalboard = self.data('pedalboard')
	    pedalboard.metadata.title = self.find('input').val()
	    self.saveBox('send')
	    return false
	}

	self.find('.js-save').click(save)
	self.find('.js-cancel-saving').click(function() {
	    self.hide()
	    return false
	})
	self.keydown(function(e) {
	    if (e.keyCode == 13)
		return save()
	    else if (e.keyCode == 27) {
		self.hide()
		return false
	    }
	})

	return self
    },

    save: function(pedalboard, callback) {
	var self = $(this)
	pedalboard.metadata = $.extend({
	    title: ''
	}, pedalboard.metadata)
	self.data('pedalboard', pedalboard)
	self.data('callback', callback)
	if (pedalboard._id)
	    self.saveBox('send')
	else
	    self.saveBox('edit')
    },

    edit: function() {
	var self = $(this)
	var metadata = self.data('pedalboard').metadata
	self.find('input').val(metadata.title).focus()
	self.show()
    },

    send: function() {
	var self = $(this)
	var pedalboard = self.data('pedalboard')
	self.data('save')(pedalboard,
			  function(id, error) {
			      if (id) {
				  self.hide()
				  pedalboard._id = id
				  self.data('callback')(pedalboard)
			      }
			      else {
				  // TODO error handling here, the Notification does not work well
				  // with popup
				  alert(error)
			      }
			  })
	return
    }

})