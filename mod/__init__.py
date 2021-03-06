
# Copyright 2012-2013 AGR Audio, Industria e Comercio LTDA. <contato@portalmod.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

from datetime import datetime, timedelta
from functools import wraps
from tornado import ioloop
import os, re, json, logging, shutil

def jsoncall(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        body = self.request.body
        self.request.jsoncall = True
        if body is not None:
            decoded = body.decode()
            if decoded:
                self.request.body = json.loads(decoded)
        result = method(self, *args, **kwargs)
        if not result is None:
            self.set_header('Content-Type', 'application/json')
            self.write(json.dumps(result, default=json_handler))
        else:
            self.set_header('Content-Type', 'text/plain')
            self.set_status(204)
    return wrapper

def json_handler(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    #print(type(obj), obj)
    return None

def _json_or_remove(path):
    try:
        return json.loads(open(path).read())
    except ValueError:
        logging.warning("not JSON, removing: %s", path)
        os.remove(path)
        return None

# Check that all objects in index are in filesystem and vice-versa
def ensure_index_sync(index, dirname):
    try:
        for obj in index.every():
            path = os.path.join(dirname, obj['id'])
            assert os.path.exists(path)
            _json_or_remove(path)
        for obj_id in os.listdir(dirname):
            if obj_id.endswith(".metadata"):
                continue
            path = os.path.join(dirname, obj_id)
            if os.path.isdir(path):
                continue
            obj = _json_or_remove(path)
            if obj and index.indexable(obj):
                next(index.find(id=obj_id))
    except Exception as e:
        # This is supposed to be AssertionError, StopIteration or AttributeError,
        # but let's just capture anything
        index.reindex()

def check_environment(callback):
    from mod.settings import (EFFECT_DIR, HARDWARE_DIR, INDEX_PATH,
                              DEVICE_SERIAL, DEVICE_MODEL,
                              DOWNLOAD_TMP_DIR, BANKS_JSON_FILE, HTML_DIR)
    from mod import indexing
    from mod.session import SESSION

    for dirname in (EFFECT_DIR, HARDWARE_DIR, DOWNLOAD_TMP_DIR):
        if not os.path.exists(dirname):
            os.makedirs(dirname)

    if not os.path.exists(BANKS_JSON_FILE):
        fh = open(BANKS_JSON_FILE, 'w')
        fh.write("[]")
        fh.close()

    # Index creation will check consistency and rebuild index if necessary
    effect_index = indexing.EffectIndex()

    # Migrations. Since we don't have a migration mechanism, let's do it here
    # TODO Migration system where we'll have migration scripts that will be marked as
    # already executed
    for effect_id in os.listdir(EFFECT_DIR):
        if effect_id.endswith('.metadata'):
            continue
        path = os.path.join(EFFECT_DIR, '%s.metadata' % effect_id)
        metadata = {}
        try:
            if os.path.exists(path):
                metadata = json.loads(open(path).read())
        except:
            pass
        metadata['release'] = metadata.get('release', 1)
        open(path, 'w').write(json.dumps(metadata))
    # TODO check if all pedalboards in banks database really exist, otherwise remove them from banks
    ensure_index_sync(effect_index, EFFECT_DIR)

    # TEMPORARIO, APENAS NO DESENVOLVIMENTO
    if os.path.exists(DEVICE_SERIAL) and not os.path.exists(DEVICE_MODEL):
        serial = open(DEVICE_SERIAL).read()
        model = re.search('^[A-Z]+').group()
        open(DEVICE_MODEL, 'w').write(model)

    def ping_callback(ok):
        if ok:
            pass
        else:
            # calls ping again every one second
            ioloop.IOLoop.instance().add_timeout(timedelta(seconds=1), lambda:SESSION.ping(ping_callback))
    SESSION.ping(ping_callback)

def rebuild_database(modguis_only = False, callback = None):
    """
    This will:
      - Delete indexes
      - Remove effect json files and parse TTL files again
      - Rebuild effect and pedalboard indexes
    """
    from mod.settings import (EFFECT_DIR, INDEX_PATH)
    from mod.indexing import EffectIndex
    from mod.lv2 import PluginSerializer, PLUGINS

    if os.path.exists(INDEX_PATH):
        shutil.rmtree(INDEX_PATH)
    if os.path.exists(EFFECT_DIR):
        shutil.rmtree(EFFECT_DIR)
    os.mkdir(EFFECT_DIR)

    i=1
    sizef=float(PLUGINS.size())

    for plugin in PLUGINS:
        if callback is not None:
            if callback(float(i*100)/sizef, plugin.get_uri().as_string()):
                break
            i += 1

        srlz = PluginSerializer(plugin=plugin)

        if srlz.has_modgui() or not modguis_only:
            srlz.save_json(EFFECT_DIR)

    if callback is not None:
        callback(100.0, "")

    # The index will be rebuilt just by instantiating it
    #PedalboardIndex()
    EffectIndex()

# Turn any string into a LV2 compatible symbol
def symbolify(name):
    # TODO
    return name
