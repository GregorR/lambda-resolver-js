// base definitions
var definitions = {
    "^true":    "^ift.^iff.ift",
    "^false":   "^ift.^iff.iff",
    "^not":     "^b.b false true",
    "^and":     "^b.^c.b c false",
    "^or":      "^b.^c.b true c",
    "^zero":    "^s.^z.z",
    "^succ":    "^n.^s.^z.s (n s z)",
    "^pred":    "^n.^s.^z.n (^m.^b.b (s (m true)) (m true)) (^b.z) false",
    "^nonzero": "^x.x (or true) false",
    "^plus":    "^m.^n.^s.^z.m s (n s z)",
    "^minus":   "^m.^n.n pred m",
    "^times":   "^m.^n.n (plus m) zero",
    "^omega":   "(^x.x x) (^x.x x)",
    "^Yc":      "^f.(^x.f (x x)) (^x.f (x x))"
};

// move definitions into the display
function refreshDefinitions() {
    var html = "";
    for (var key in definitions) {
        if (key[0] == "^") {
            html += key.slice(1) + " = " + definitions[key] + "<br/>";
        }
    }
    document.getElementById("definitions").innerHTML = html;
}

// general object cloner
function clone(obj) {
    var into = new obj.constructor();
    for (var key in obj) {
        into[key] = obj[key];
    }
    return into;
}


/******************************************************************************
 * LEXING
 *****************************************************************************/

// is this alphanumeric+_?
function isalphanum(str) {
    var i;
    for (i = 0; i < str.length; i++) {
        if ((str[i] < "a" || str[i] > "z") &&
            (str[i] < "A" || str[i] > "Z") &&
            (str[i] < "0" || str[i] > "9") &&
            str[i] != "_") {
            return false;
        }
    }
    return true;
}


// is this numeric?
function isnumeric(str) {
    var i;
    for (i = 0; i < str.length; i++) {
        if (str[i] < "0" || str[i] > "9") {
            return false;
        }
    }
    return true;
}


// is this whitespace?
function iswhite(str) {
    var i;
    for (i = 0; i < str.length; i++) {
        if (str[i] != " " &&
            str[i] != "\t" &&
            str[i] != "\r" &&
            str[i] != "\n") {
            return false;
        }
    }
    return true;
}

// lex a lambda expression
function lex(inp) {
    var lexed = [];
    var alphanum = false;
    var i;
    var tok = "";

    function acceptTok() {
        if (tok != "") {
            lexed.push(tok);
            tok = "";
        }
    }

    for (i = 0; i < inp.length; i++) {
        if (iswhite(inp[i])) {
            acceptTok();

        } else if (isalphanum(inp[i])) {
            if (alphanum) {
                tok += inp[i];
            } else {
                acceptTok();
                tok = inp[i];
                alphanum = true;
            }

        } else {
            if (alphanum) {
                acceptTok();
                tok = inp[i];
                alphanum = false;
            } else {
                acceptTok();
                tok = inp[i];
            }

        }
    }

    acceptTok();

    return lexed;
}


/******************************************************************************
 * PARSE TREE NODES
 *****************************************************************************/
function Word(tok) {
    this.isWord = true;
    this.tok = tok;
}
Word.prototype.depth = function() { return 1; };
Word.prototype.dup = function() {
    var ret = clone(this);
    return ret;
};

function Lambda(lvar, exp) {
    this.isLambda = true;
    this.lvar = lvar;
    this.exp = exp;
}
Lambda.prototype.depth = function() {
    return 1 + this.exp.depth();
};
Lambda.prototype.dup = function() {
    var ret = clone(this);
    ret.exp = this.exp.dup();
    return ret;
};

function Application(func, arg) {
    this.isApplication = true;
    this.func = func;
    this.arg = arg;
}
Application.prototype.depth = function() {
    var funcd = this.func.depth();
    var argd = this.arg.depth();
    var maxd = funcd;
    if (argd > maxd) maxd = argd;
    return 1 + maxd;
};
Application.prototype.dup = function() {
    var ret = clone(this);
    ret.func = this.func.dup();
    ret.arg = this.arg.dup();
    return ret;
};


/******************************************************************************
 * PARSING
 *****************************************************************************/

// a token position in a token stream
function TokPos(toks, pos) {
    this.toks = toks;
    this.pos = pos;
}
TokPos.prototype.tok = function() {
    return this.toks[this.pos];
};
TokPos.prototype.step = function() {
    this.pos++;
    if (this.pos >= this.toks.length)
        return false;
    return true;
};
TokPos.prototype.eof = function() {
    if (this.pos >= this.toks.length)
        return true;
    return false;
};

// output an error
function error(str) {
    document.getElementById("errors").innerHTML += str + "<br/>";
}

// parse a lambda expression
function parseExp(tokpos) {
    var exp;

    // get the first part of an application
    exp = parseValue(tokpos);

    // now look for applications
    for (tok = tokpos.tok();
         !tokpos.eof() && tok != ")";
         tok = tokpos.tok()) {
        exp = new Application(exp, parseValue(tokpos));
    }

    return exp;
}

// parse a value
function parseValue(tokpos) {
    var tok = tokpos.tok();
    if (tok == "^") {
        // just a lambda expression
        if (!tokpos.step()) {
            error("Poorly-formed lambda.");
            return null;
        }

        return parseLambda(tokpos);

    } else if (tok == "(") {
        // could be a lambda, it's just "something" in parens
        if (tokpos.step()) {
            var exp = parseExp(tokpos);
            // now we should be at a closing )
            tokpos.step();
            return exp;
        } else {
            error("Unterminated parenthesis.");
            tokpos.step();
            return null;
        }

    } else if (isalphanum(tok)) {
        tokpos.step();
        return new Word(tok);

    } else {
        error("Unrecognized token: " + tok);
        tokpos.step();
        return null;

    }
}

// parse a lambda
function parseLambda(tokpos) {
    // lambdas have a very specific form which must be followed

    // the variable
    tok = tokpos.tok();
    if (!isalphanum(tok)) {
        error("Invalid lambda parameter.");
        tokpos.step();
        return null;
    }
    var lvar = tok;
    if (!tokpos.step()) {
        error("Incomplete lambda (no dot).");
        tokpos.step();
        return null;
    }

    // then either more variables or a dot
    tok = tokpos.tok();
    if (isalphanum(tok)) {
        // a variable, sublambda
        return new Lambda(lvar, parseLambda(tokpos));

    } else if (tok != ".") {
        error("Improperly formatted lambda.");
        tokpos.step();
        return null;
    }
    if (!tokpos.step()) {
        error("Incomplete lambda (no expression).");
        tokpos.step();
        return null;
    }

    // then the expression
    return new Lambda(lvar, parseExp(tokpos));
}

// try to expand a definition
function expandDefinition(tok) {
    var ltok = "^" + tok;
    if (definitions[ltok] !== undefined) {
        var toks = lex(definitions[ltok]);
        var res = parseExp(new TokPos(toks, 0));
        return res;

    } else if (isnumeric(tok)) {
        var res = "zero";
        var num = parseInt(tok);
        for (; num > 0; num--) {
            res = "(succ " + res + ")";
        }
        res = parseExp(new TokPos(lex(res), 0));
        return res;

    } else {
        return false;
    }
}


/******************************************************************************
 * UNPARSING
 *****************************************************************************/
function simpleUnparse(exp) {
    if (exp.isWord) {
        return exp.tok;

    } else if (exp.isLambda) {
        return "(&lambda;" + exp.lvar + "." + simpleUnparse(exp.exp) + ")";

    } else if (exp.isApplication) {
        return "(" + simpleUnparse(exp.func) + " " + simpleUnparse(exp.arg) + ")";

    }
}

var unparseColors = [
    "red", "lightgreen",
    "orange", "cyan",
    "yellow", "pink"
];
function colorUnparse(exp, depth) {
    if (depth === undefined) depth = 0;
    depth %= unparseColors.length;

    // use the annotation if possible
    if (exp.colorDepth === undefined) {
        exp.colorDepth = depth;
    } else {
        depth = exp.colorDepth;
    }

    if (exp.isWord) {
        return exp.tok;

    } else if (exp.isLambda) {
        return "<span style='color: " + unparseColors[depth] + "'>(&lambda;" +
               exp.lvar + "." + colorUnparse(exp.exp, depth + 1) + ")</span>";

    } else if (exp.isApplication) {
        return "<span style='color: " + unparseColors[depth] + "'>(" +
               colorUnparse(exp.func, depth + 1) + " " + colorUnparse(exp.arg, depth + 1) +
               ")</span>";

    }
}

function fancyUnparse(exp, depth) {
    if (depth === undefined) depth = 0;
    depth %= unparseColors.length;

    // use the annotation if possible
    if (exp.colorDepth === undefined) {
        exp.colorDepth = depth;
    } else {
        depth = exp.colorDepth;
    }

    if (exp.isWord) {
        return exp.tok;

    } else if (exp.isLambda) {
        return "<table border='1' style='background-color: " +
               unparseColors[depth] +
               "; color: black; margin: 0.5em'><tr><td>&lambda;" +
               exp.lvar +
               ".</td><td>" +
               fancyUnparse(exp.exp, depth + 1) +
               "</td></tr></table>";

    } else if (exp.isApplication) {
        return "<table border='1' style='background-color: " +
               unparseColors[depth] +
               "; color: black; margin: 0.5em'><tr><td>" +
               fancyUnparse(exp.func, depth + 1) +
               "</td><td>" +
               fancyUnparse(exp.arg, depth + 1) +
               "</span></td></tr></table>";

    }
}



/******************************************************************************
 * VARIABLE RENAMING
 *****************************************************************************/
function renameVariables(exp, curnames, primes) {
    if (exp.isWord) {
        // is this word renamed?
        var lname = "^" + exp.tok;
        if (curnames[lname] !== undefined) {
            exp.tok = curnames[lname];
        }

    } else if (exp.isLambda) {
        // rename this variable
        var lname = "^" + exp.lvar;

        // if it had a rename before, get rid of it
        var i;
        var toname = exp.lvar;
        for (i = 0; i < toname.length; i++) {
            if (toname[i] == "'") {
                toname = toname.substr(0, i);
                break;
            }
        }

        // then rename it
        toname += "'" + primes + "'";
        exp.lvar = toname;
        
        // if it's already there, keep it in mind
        var prev = curnames[lname];
        curnames[lname] = toname;

        // now rename in the lambda expression
        primes++;
        primes = renameVariables(exp.exp, curnames, primes);

        curnames[lname] = prev;
        
    } else if (exp.isApplication) {
        primes = renameVariables(exp.func, curnames, primes);
        primes = renameVariables(exp.arg, curnames, primes);

    }

    return primes;
}


/******************************************************************************
 * REDUCTION
 *****************************************************************************/
function normalOrderReduce(exp, primes) {
    if (exp.isApplication) {
        // this is the only situation in which we can reduce with normal order
        if (exp.func.isLambda) {
            // perform the actual application
            var res = lambdaReplace(exp.func.exp, exp.func.lvar, exp.arg, primes);
            return res;

        } else if (exp.func.isWord) {
            // try to expand definitions
            var res = expandDefinition(exp.func.tok);
            if (res === false) {
                return false;
            } else {
                primes = renameVariables(res, new Object, primes);
                exp.func = res;
                return [exp, primes];
            }

        } else {
            // try to reduce the function
            var res = normalOrderReduce(exp.func, primes);
            if (res === false) {
                return false;
            } else {
                exp.func = res[0];
                return [exp, res[1]];
            }

        }

    } else {
        // can't reduce it
        return false;

    }
}

// slightly eager reduction
function eagerishReduce(exp, primes) {
    if (exp.isApplication) {
        // use a normal order here
        var res = normalOrderReduce(exp, primes);
        if (res === false) {
            // just reduce the right
            res = eagerishReduce(exp.arg, primes);
            if (res === false) {
                return false;

            } else {
                exp.arg = res[0];
                return [exp, res[1]];

            }
        } else {
            return res;
        }

    } else if (exp.isLambda) {
        // we can reduce the argument (maybe)
        var res = eagerishReduce(exp.exp, primes);
        if (res === false) {
            // couldn't reduce! :(
            return false;

        } else {
            // make sure we've actually /reduced/ it
            var resdepth = res[0].depth();
            var expdepth = exp.depth();
            if (resdepth >= expdepth) {
                return false;
            } else {
                exp.exp = res[0];
                return [exp, res[1]];
            }
        }

    } else {
        // can't reduce it
        return false;

    }
}


// replace a name with a value in an expression
function lambdaReplace(exp, name, val, primes) {
    if (exp.isWord) {
        if (exp.tok == name) {
            // found one!
            var ret = val.dup();
            primes = renameVariables(ret, new Object, primes);
            return [ret, primes];

        } else {
            return [exp, primes];

        }

    } else if (exp.isLambda) {
        var ret = lambdaReplace(exp.exp, name, val, primes);
        exp.exp = ret[0];
        return [exp, ret[1]];

    } else if (exp.isApplication) {
        var ret = lambdaReplace(exp.func, name, val, primes);
        exp.func = ret[0];
        ret = lambdaReplace(exp.arg, name, val, ret[1]);
        exp.arg = ret[0];
        return [exp, ret[1]];

    }
}


/******************************************************************************
 * UI
 *****************************************************************************/
// should we show all steps, or an animation?
var showIntermediateSteps = true;

// should we show boxes, or just lambdas?
var showBoxes = true;

function handleInput(evt, inp) {
    var keyCode = null;

    if (evt.which) {
        keyCode = evt.which;
    } else {
        keyCode = evt.keyCode;
    }

    if (keyCode == 13) {
        handleInputPrime(inp.value);

        return false;
    } else {
        return true;
    }
}

// handle an input string
function handleInputPrime(str)
{
    // make sure we're not stopped
    stopStepping = false;

    // check modes
    if (document.getElementById("showIntermediateSteps").checked) {
        showIntermediateSteps = true;
    } else {
        showIntermediateSteps = false;
    }

    if (document.getElementById("showBoxes").checked) {
        showBoxes = true;
    } else {
        showBoxes = false;
    }

    // lex ...
    var toks = lex(str);

    // check for definitions
    if (toks.length > 2 && toks[1] == "=") {
        definitions["^" + toks[0]] = toks.slice(2).join(" ");
        refreshDefinitions();

    } else if (toks.length == 2 && toks[0] == "!") {
        // get rid of a definition
        delete definitions["^" + toks[1]];
        refreshDefinitions();

    } else {
        // parse ...
        var parsed = parseExp(new TokPos(toks, 0));

        // rename variables
        var primes = renameVariables(parsed, new Object, 1);

        // start with nothing
        document.getElementById("result").innerHTML = "";

        // then perform steps
        setTimeout(function(){performLambdaStep(parsed, primes);}, 0);
    }
}


var stopStepping = false;

// perform a lambda step and output
function performLambdaStep(exp, primes) {
    // show the current version
    var resultdiv = document.getElementById("result");
    if (showIntermediateSteps) {
        resultdiv.innerHTML +=
            colorUnparse(exp) + "<br/>";
    } else {
        resultdiv.innerHTML = colorUnparse(exp) + "<br/>";
    }
    if (showBoxes) {
        resultdiv.innerHTML += fancyUnparse(exp) + "<hr/>";
    }

    // should we stop?
    if (stopStepping) {
        stopStepping = false;
        return;
    }

    // reduce ...
    //var res = normalOrderReduce(exp);
    var res = eagerishReduce(exp, primes);
    if (res !== false) {
        setTimeout(function(){performLambdaStep(res[0], res[1]);},
                   showIntermediateSteps ? 0 : 250);

    }
}

// stop stepping
function forceStop() {
    stopStepping = true;
}
