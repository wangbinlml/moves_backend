const express = require('express');
const mysql = require('../core/mysql');
const log = require('../core/logger').getLogger("system");
const router = express.Router();
const _ = require('lodash');
const common = require('../core/common');

/* GET users listing. */
router.get('/', (req, res, next) => {
    res.render('menu_role', {
        user: req.session.user,
        menus: req.session.menus,
        menu_active: req.session.menu_active['/menu_role'],
        title: '菜单权限管理'
    });
});

router.get('/get_menu', async (req, res, next) => {
    var result = {
        error: 0,
        data: {}
    };
    try {
        var role_id = req.query.role_id;
        var sql = "select a.menu_id from bs_menu a inner join bs_menu_role b on a.menu_id=b.menu_id where b.role_id=? and a.is_del=0";
        var sql2 = "select * from bs_menu where is_del=0";
        var menuId = await mysql.query(sql, role_id);
        var menus = await mysql.query(sql2);
        result.data['menus'] = getAllMenu(menus);
        var ids = [];
        for (var i = 0; i < menuId.length; i++) {
            ids.push(menuId[i]['menu_id'] + "");
        }
        result['data']['menuId'] = ids;
        res.status(200).json(result);
    } catch (e) {
        result.error = 1;
        res.status(500).json(result);
    }
});
var getAllMenu = (menu_roles) => {
    var menus = [];
    if (menu_roles.length) {
        for (var i = 0; i < menu_roles.length; i++) {
            var menuRoleObj = menu_roles[i];
            var parent_id = menuRoleObj['parent_id'];
            if (parent_id == 0) {
                var menuObj = {};
                menuObj['parent_id'] = parent_id;
                menuObj['menu_id'] = menuRoleObj['menu_id'];
                menuObj['menu_name'] = menuRoleObj['menu_name'];
                menuObj['menu_url'] = menuRoleObj['menu_url'];
                menuObj['menu_icon'] = menuRoleObj['menu_icon'];
                menuObj['menu_child'] = [];
                menus.push(menuObj);
            } else {
                for (var j = 0; j < menus.length; j++) {
                    var menuObj = menus[j];
                    var pid = menuObj['menu_id'];
                    if (pid == parent_id) {
                        var childObj = {}, menu_id = menuRoleObj['menu_id'], menu_url = menuRoleObj['menu_url'];
                        childObj['menu_id'] = menu_id;
                        childObj['parent_id'] = menuRoleObj['parent_id'];
                        childObj['menu_name'] = menuRoleObj['menu_name'];
                        childObj['menu_url'] = menu_url;
                        childObj['menu_icon'] = menuRoleObj['menu_icon'];
                        menuObj['menu_child'].push(childObj);
                    }
                }
            }

        }
    }
    return menus;
};
router.get('/load', async (req, res, next) => {
    var sqlcount = "select count(*) count from bs_role where is_del=0";
    var sql = "select * from bs_role where is_del=0";

    var start = req.query.start;
    var length = req.query.length;
    var draw = req.query.draw;
    if (!start || !draw || !length) {
        res.status(401).json("invoke error!");
        return;
    }

    start = parseInt(start) || 0;
    length = parseInt(length) || 0;
    draw = parseInt(draw) || 0;
    var search = req.query.search;
    if (search) {
        sqlcount = sqlcount + " and role_name like '%" + search.value + "%'";
        sql = sql + " and role_name like '%" + search.value + "%'";
    }

    var memuCount = await mysql.query(sqlcount);
    sql = sql + " ORDER BY role_id ASC limit " + start + "," + length;
    var result = await mysql.query(sql);
    var backResult = {
        draw: draw,
        recordsTotal: memuCount['0']['count'],
        recordsFiltered: memuCount['0']['count'],
        data: []
    };
    for (var i in result) {
        backResult.data.push({
            role_id: result[i].role_id,
            is: result[i].role_id + "_",
            role_name: result[i].role_name,
            description: result[i].description,
        });
    }
    res.status(200).json(backResult);
});
router.post('/setMenu', async (req, res, next) => {
    var result = {
        error: 0,
        msg: "",
        data: []
    };
    var e_id = req.body.e_id;
    var e_menus = req.body.e_menus || [];
    if (e_id && e_id != "" && e_id != 0) {
        var conn = await mysql.getConnection();
        await mysql.beginTransaction(conn);
        try {
            if (!_.isArray(e_menus)) {
                e_menus = [e_menus]
            }
            var sql = "delete from bs_menu_role where role_id = ?";
            var sql2 = "insert into bs_menu_role(role_id, menu_id) values (?,?)";
            await mysql.query2(conn, sql, e_id);
            for (var i = 0; i < e_menus.length; i++) {
                await mysql.query2(conn, sql2, [e_id, e_menus[i]]);
            }
            await mysql.commit(conn);
            await common.saveOperateLog(req, "绑定菜单ID:" + e_id + ";roles:" + e_menus);
            res.status(200).json(result);
        } catch (e) {
            mysql.rollback(conn);
            log.error("menu_role set menu: ", e);
            result.error = 1;
            res.status(500).json(result);
        }
    } else {
        result.error = 1;
        result.msg = "无效角色";
        res.status(200).json(result);
    }
});
module.exports = router;
