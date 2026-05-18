extends RefCounted
class_name CreditsContent

# Hardcoded from assets/sounds/music/music_credits.txt and sfx/sfx_credits.txt
# (plain .txt files are not reliable after Web export)

const MUSIC_CREDITS: String = """[b]Music Credits[/b]

All music by Kevin MacLeod (incompetech.com) unless otherwise noted.
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"Equatorial Complex"
"That Zen Moment" 
"Furious Freak"

[b]Main Menu Theme[/b]
"Main Theme" by Kevin MacLeod

[b]World Themes[/b]
"World 1 Theme" by Kevin MacLeod
"World 2 Theme" by Kevin MacLeod
"World 3 Theme" by Kevin MacLeod
"World 4 Theme" by Kevin MacLeod
"World 5 Theme" by Kevin MacLeod
"World 6 Theme" by Kevin MacLeod

[b]Bonus Tracks[/b]
"Chill Mode" by Kevin MacLeod
"Action Mode" Music by <a href="https://pixabay.com/users/nickpanekaiassets-38266323/">Nicholas Panek</a> from <a href="https://pixabay.com/music/">Pixabay</a>
"Retro Mode" Music by <a href="https://pixabay.com/users/ayitsmatt-17164088/">Matthew Pin</a> from <a href="https://pixabay.com/music/">Pixabay</a>"""

const SFX_CREDITS: String = """[b]Sound Effects Credits[/b]

Sound Effects downloaded from Pixabay
All sounds are royalty-free under the Pixabay Content License

Search for more: https://pixabay.com/sound-effects/

Sound Effect by <a href="https://pixabay.com/users/dogwolf123-53439420/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=474792">dogwolf123</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=474792">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/soynoviembre-53307013/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=440353">José Mejía</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=440353">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=102844">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=102844">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=81509">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=81509">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/universfield-28281460/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=323603">Universfield</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=323603">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=46134">freesound_community</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=46134">Pixabay</a>

Sound Effect by <a href="https://pixabay.com/users/denielcz-50993549/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=463070">DenielCZ</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=463070">Pixabay</a>"""

static func combined_bbcode() -> String:
	var music := _html_to_bbcode(MUSIC_CREDITS)
	var sfx := _html_to_bbcode(SFX_CREDITS)
	return music + "\n\n" + sfx

static func _html_to_bbcode(html: String) -> String:
	var re := RegEx.new()
	re.compile("<a href=\"([^\"]+)\">([^<]+)</a>")
	return re.sub(html, "[url=$1]$2[/url]", true)
